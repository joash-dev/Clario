/**
 * Multi-provider AI (OpenAI + Google Gemini). Rate limiting should be added at HTTP middleware later (per-user/IP).
 */
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";
import OpenAI from "openai";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";

const MAX_SUMMARY_TOKENS = 256;
const MAX_SUGGEST_TOKENS = 200;
const MAX_SUGGESTIONS = 10;

const FALLBACK_TEXT = "Unable to generate response";

function getOpenAIClient(): OpenAI {
  const key = env.OPENAI_API_KEY;
  if (!key) {
    throw new HttpError(503, "AI processing error", "AI_ERROR");
  }
  return new OpenAI({
    apiKey: key,
    timeout: 60_000,
  });
}

let geminiClient: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    throw new HttpError(503, "AI processing error", "AI_ERROR");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(key);
  }
  return geminiClient;
}

function sanitizeInput(text: string): string {
  const t = text.trim();
  if (t.length === 0) {
    throw new HttpError(400, "Text cannot be empty", "VALIDATION_ERROR");
  }
  return t;
}

function normalizeSummaryOutput(raw: string): string {
  const s = raw.trim();
  return s.length > 0 ? s : FALLBACK_TEXT;
}

function mapOpenAIError(err: unknown): never {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      throw new HttpError(429, "Rate limit exceeded", "RATE_LIMIT");
    }
  }
  const e = err as { code?: string; name?: string; message?: string };
  const msg = typeof e.message === "string" ? e.message : "";
  if (
    e.name === "AbortError" ||
    e.code === "ETIMEDOUT" ||
    /timeout|timed out|ETIMEDOUT/i.test(msg)
  ) {
    throw new HttpError(503, "AI service unavailable", "AI_UNAVAILABLE");
  }
  throw new HttpError(503, "AI processing error", "AI_ERROR");
}

/** Maps Gemini SDK errors to the same HTTP outcomes as OpenAI; never exposes raw API payloads. */
function mapGeminiError(err: unknown): never {
  if (err instanceof GoogleGenerativeAIFetchError) {
    if (err.status === 429) {
      throw new HttpError(429, "Rate limit exceeded", "RATE_LIMIT");
    }
  }
  if (err instanceof GoogleGenerativeAIAbortError) {
    throw new HttpError(503, "AI service unavailable", "AI_UNAVAILABLE");
  }
  const e = err as { code?: string; name?: string; message?: string; status?: number };
  const msg = typeof e.message === "string" ? e.message : "";
  if (e.status === 429) {
    throw new HttpError(429, "Rate limit exceeded", "RATE_LIMIT");
  }
  if (
    e.name === "AbortError" ||
    e.code === "ETIMEDOUT" ||
    e.code === "ECONNRESET" ||
    e.code === "ENOTFOUND" ||
    /timeout|timed out|ETIMEDOUT|network|fetch failed/i.test(msg)
  ) {
    throw new HttpError(503, "AI service unavailable", "AI_UNAVAILABLE");
  }
  throw new HttpError(503, "AI processing error", "AI_ERROR");
}

function logAi(kind: "summarize" | "suggest", durationMs: number, inputLength: number): void {
  const previewLen = Math.min(80, inputLength);
  console.log(
    `[ai] ${kind} durationMs=${durationMs} inputLen=${inputLength} previewLen=${previewLen}`
  );
}

async function openaiSummarize(text: string): Promise<string> {
  const t0 = Date.now();
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      max_tokens: MAX_SUMMARY_TOKENS,
      messages: [
        {
          role: "system",
          content:
            "You summarize user notes concisely. Respond with plain text only, no markdown fences.",
        },
        { role: "user", content: text },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const out = normalizeSummaryOutput(typeof raw === "string" ? raw : String(raw));
    logAi("summarize", Date.now() - t0, text.length);
    return out;
  } catch (err) {
    mapOpenAIError(err);
  }
}

async function geminiSummarize(text: string): Promise<string> {
  const t0 = Date.now();
  try {
    const model = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      systemInstruction:
        "You summarize user notes concisely. Respond with plain text only, no markdown fences.",
      generationConfig: { maxOutputTokens: MAX_SUMMARY_TOKENS },
    });
    const result = await model.generateContent(text);
    const raw = result.response.text();
    const out = normalizeSummaryOutput(typeof raw === "string" ? raw : String(raw));
    logAi("summarize", Date.now() - t0, text.length);
    return out;
  } catch (err) {
    mapGeminiError(err);
  }
}

function normalizeSuggestionList(items: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const s = item.trim();
    if (s.length === 0) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

function parseSuggestionsFromText(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return normalizeSuggestionList(parsed);
    }
  } catch {
    /* fallback below */
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((l) => l.length > 0);
  return normalizeSuggestionList(lines);
}

async function openaiSuggestTasks(text: string): Promise<string[]> {
  const t0 = Date.now();
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      max_tokens: MAX_SUGGEST_TOKENS,
      messages: [
        {
          role: "system",
          content:
            'Suggest actionable tasks from the user text. Reply with a JSON array of strings only, e.g. ["task one","task two"]. No more than 10 items.',
        },
        { role: "user", content: text },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const str = typeof raw === "string" ? raw : String(raw);
    let suggestions = parseSuggestionsFromText(str);
    if (suggestions.length === 0 && str.trim().length > 0) {
      suggestions = normalizeSuggestionList([str.trim()]);
    }
    logAi("suggest", Date.now() - t0, text.length);
    return suggestions;
  } catch (err) {
    mapOpenAIError(err);
  }
}

async function geminiSuggestTasks(text: string): Promise<string[]> {
  const t0 = Date.now();
  try {
    const model = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      systemInstruction:
        'Suggest actionable tasks from the user text. Reply with a JSON array of strings only, e.g. ["task one","task two"]. No more than 10 items.',
      generationConfig: { maxOutputTokens: MAX_SUGGEST_TOKENS },
    });
    const result = await model.generateContent(text);
    const raw = result.response.text();
    const str = typeof raw === "string" ? raw : String(raw);
    let suggestions = parseSuggestionsFromText(str);
    if (suggestions.length === 0 && str.trim().length > 0) {
      suggestions = normalizeSuggestionList([str.trim()]);
    }
    logAi("suggest", Date.now() - t0, text.length);
    return suggestions;
  } catch (err) {
    mapGeminiError(err);
  }
}

export async function summarizeText(text: string): Promise<string> {
  const input = sanitizeInput(text);
  const hasOpenai = Boolean(env.OPENAI_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);
  try {
    if (env.AI_PROVIDER === "gemini") {
      return await geminiSummarize(input);
    }
    return await openaiSummarize(input);
  } catch (first) {
    const canFallback =
      (env.AI_PROVIDER === "gemini" && hasOpenai) ||
      (env.AI_PROVIDER === "openai" && hasGemini);
    if (!canFallback) throw first;
    if (env.AI_PROVIDER === "gemini") {
      return await openaiSummarize(input);
    }
    return await geminiSummarize(input);
  }
}

export async function suggestTasks(text: string): Promise<string[]> {
  const input = sanitizeInput(text);
  const hasOpenai = Boolean(env.OPENAI_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);
  try {
    if (env.AI_PROVIDER === "gemini") {
      return await geminiSuggestTasks(input);
    }
    return await openaiSuggestTasks(input);
  } catch (first) {
    const canFallback =
      (env.AI_PROVIDER === "gemini" && hasOpenai) ||
      (env.AI_PROVIDER === "openai" && hasGemini);
    if (!canFallback) throw first;
    if (env.AI_PROVIDER === "gemini") {
      return await openaiSuggestTasks(input);
    }
    return await geminiSuggestTasks(input);
  }
}
