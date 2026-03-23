/**
 * Multi-provider AI (OpenAI + Google Gemini). Rate limiting should be added at HTTP middleware later (per-user/IP).
 */
import type { Note, Task } from "@prisma/client";
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
  const e = err as {
    code?: string;
    name?: string;
    message?: string;
    status?: number;
    statusText?: string;
  };
  const msg = typeof e.message === "string" ? e.message : "";

  if (env.NODE_ENV !== "production") {
    console.error("[ai] Gemini error:", msg || err);
  }

  if (err instanceof GoogleGenerativeAIFetchError) {
    if (err.status === 429) {
      throw new HttpError(429, "Rate limit exceeded", "RATE_LIMIT");
    }
    if (err.status === 404 || /not found|does not exist|No such model/i.test(msg)) {
      throw new HttpError(
        503,
        "Gemini model not found. Set GEMINI_MODEL to a current model id (see Google AI docs).",
        "AI_MODEL_ERROR"
      );
    }
    if (err.status === 401 || err.status === 403) {
      throw new HttpError(503, "Gemini API rejected the request (check GEMINI_API_KEY).", "AI_AUTH");
    }
  }
  if (err instanceof GoogleGenerativeAIAbortError) {
    throw new HttpError(503, "AI service unavailable", "AI_UNAVAILABLE");
  }
  if (e.status === 429) {
    throw new HttpError(429, "Rate limit exceeded", "RATE_LIMIT");
  }
  if (
    e.status === 401 ||
    e.status === 403 ||
    /API key not valid|PERMISSION_DENIED|API_KEY_INVALID/i.test(msg)
  ) {
    throw new HttpError(503, "Gemini API rejected the request (check GEMINI_API_KEY).", "AI_AUTH");
  }
  if (e.status === 404 || /not found|No such model|is not found for API version/i.test(msg)) {
    throw new HttpError(
      503,
      "Gemini model not found. Set GEMINI_MODEL to a current model id (see Google AI docs).",
      "AI_MODEL_ERROR"
    );
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

const MAX_CHAT_OUT_TOKENS = 1024;

export type ChatContext = { tasks: Task[]; notes: Note[] };

function buildChatSystemPrompt(context: ChatContext): string {
  const taskList =
    context.tasks.length > 0
      ? context.tasks
          .map(
            (t) =>
              `- "${t.title}" | Status: ${t.status} | Priority: ${t.priority}${
                t.dueAt ? " | Due: " + new Date(t.dueAt).toLocaleDateString() : ""
              }`
          )
          .join("\n")
      : "No tasks yet";

  const noteList =
    context.notes.length > 0
      ? context.notes
          .map(
            (n) =>
              `- Title: "${n.title || "Untitled"}" | Content: ${(n.content ?? "").substring(0, 300)}`
          )
          .join("\n")
      : "No notes yet";

  return `You are Clario, a smart AI productivity assistant built into a productivity app.

You have FULL ACCESS to the user's real data shown below.
Always answer based on this data. Never say you don't have access to their data.

TODAY'S DATE: ${new Date().toLocaleDateString()}

USER'S TASKS (${context.tasks.length} total):
${taskList}

USER'S NOTES (${context.notes.length} total):
${noteList}

INSTRUCTIONS:
- Answer questions about their tasks and notes directly
- If asked "what's due today" check the due dates above
- If asked to summarize notes, summarize the content above
- If asked what to focus on, suggest based on priority
- Be concise and friendly
- Use the actual data — never make up tasks or notes
- If they have no tasks or notes yet, encourage them to create some`;
}

function logAi(kind: "summarize" | "suggest" | "chat", durationMs: number, inputLength: number): void {
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

const TASK_TITLE_PROMPT_EXTRA = `Return task titles as plain text only. No quotes, no trailing commas, no punctuation at the end of titles. Each title should be a clean actionable phrase like:
Review Math Chapter 4
Finish history essay
Prepare science presentation`;

function sanitizeTaskTitle(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^['"`]+|['"`]+$/g, "").trim();
  s = s.replace(/[,.]+$/g, "").trim();
  s = s.replace(/\.+$/g, "").trim();
  return s;
}

function isValidTaskTitle(s: string): boolean {
  if (s.length < 3) return false;
  return /[a-zA-Z0-9]/.test(s);
}

function normalizeSuggestionList(items: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const s = sanitizeTaskTitle(item);
    if (!isValidTaskTitle(s)) continue;
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
          content: `Suggest actionable tasks from the user text. Reply with a JSON array of strings only, e.g. ["task one","task two"]. No more than 10 items.

${TASK_TITLE_PROMPT_EXTRA}`,
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
      systemInstruction: `Suggest actionable tasks from the user text. Reply with a JSON array of strings only, e.g. ["task one","task two"]. No more than 10 items.

${TASK_TITLE_PROMPT_EXTRA}`,
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

export type ChatHistoryTurn = { role: "user" | "assistant"; content: string };

async function openaiChat(
  message: string,
  conversationHistory: ChatHistoryTurn[],
  systemPrompt: string
): Promise<string> {
  const t0 = Date.now();
  try {
    const client = getOpenAIClient();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      { role: "user", content: message },
    ];
    const completion = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      max_tokens: MAX_CHAT_OUT_TOKENS,
      messages,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const out = (typeof raw === "string" ? raw : String(raw)).trim();
    logAi("chat", Date.now() - t0, message.length);
    return out.length > 0 ? out : FALLBACK_TEXT;
  } catch (err) {
    mapOpenAIError(err);
  }
}

async function geminiChat(
  message: string,
  conversationHistory: ChatHistoryTurn[],
  systemPrompt: string
): Promise<string> {
  const t0 = Date.now();
  try {
    const model = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });
    const history = conversationHistory.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.content }],
    }));
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const raw = result.response.text();
    const out = (typeof raw === "string" ? raw : String(raw)).trim();
    logAi("chat", Date.now() - t0, message.length);
    return out.length > 0 ? out : FALLBACK_TEXT;
  } catch (err) {
    mapGeminiError(err);
  }
}

export async function chat(
  message: string,
  conversationHistory: ChatHistoryTurn[],
  context: ChatContext
): Promise<string> {
  const input = sanitizeInput(message);
  if (conversationHistory.length > 40) {
    throw new HttpError(400, "Conversation history is too long", "VALIDATION_ERROR");
  }
  const systemPrompt = buildChatSystemPrompt(context);
  const hasOpenai = Boolean(env.OPENAI_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);
  try {
    if (env.AI_PROVIDER === "gemini") {
      return await geminiChat(input, conversationHistory, systemPrompt);
    }
    return await openaiChat(input, conversationHistory, systemPrompt);
  } catch (first) {
    const canFallback =
      (env.AI_PROVIDER === "gemini" && hasOpenai) ||
      (env.AI_PROVIDER === "openai" && hasGemini);
    if (!canFallback) throw first;
    if (env.AI_PROVIDER === "gemini") {
      return await openaiChat(input, conversationHistory, systemPrompt);
    }
    return await geminiChat(input, conversationHistory, systemPrompt);
  }
}
