---
name: Phase 4 AI Integration
overview: Add OpenAI-backed `ai.service.ts`, generic `/api/v1/ai/*` routes, and `POST /api/v1/notes/:id/summarize` that persists summary metadata on the note—without queues, with Zod validation and safe error mapping.
todos:
  - id: deps-env
    content: Add openai package; extend env.ts + .env.example with OPENAI_API_KEY, OPENAI_MODEL
    status: completed
  - id: ai-service
    content: Implement ai.service.ts (summarizeText, suggestTasks, error mapping, no key leak)
    status: completed
  - id: note-summarize
    content: Add summarizeNoteForUser in note.service.ts; wire POST /notes/:id/summarize
    status: completed
  - id: ai-routes
    content: Add ai.routes.ts + mount /ai in routes/index.ts
    status: completed
isProject: false
---

# Phase 4: AI integration (plan)

This file is the **design/plan** only. Updating it does **not** require code changes until you explicitly start implementation.

## Dependencies and environment

- Add `**openai`** npm package (official SDK; works with `OPENAI_API_KEY` + `OPENAI_MODEL`).
- Extend `[apps/api/src/config/env.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\config\env.ts)` with:
  - `OPENAI_API_KEY` — required non-empty string when AI routes are used (validate at startup like other secrets).
  - `OPENAI_MODEL` — default e.g. `gpt-4o-mini` or `gpt-4.1-mini` for cost-aware MVP.
- Update `[apps/api/.env.example](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\.env.example)` (and local `.env` only if you maintain a dev template—user can add keys themselves).

## Core: `[src/services/ai.service.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\services\ai.service.ts)`

- Instantiate `**OpenAI**` once (module scope) using `env.OPENAI_API_KEY` (never log or return the key). Use `**env.OPENAI_MODEL**` for every chat call — **no hardcoded model string** in prompts or options; keep model + client config centralized in this file.
- `**summarizeText(text: string): Promise<string>`** — chat completion with a fixed system prompt (“concise summary”), user message = input text.
- `**suggestTasks(text: string): Promise<string[]>`** — chat completion asking for a **JSON array of short task strings**; parse with `JSON.parse` inside try/catch; fallback to splitting non-empty lines if JSON invalid.

### Micro-polish (ai.service behavior — plan only until you implement)

1. **Input sanitization:** `trim` before sending to OpenAI; if `text.trim()` is empty → throw `**400`** with message `**Text cannot be empty`** (same for both summarize and suggest entry points).
2. **Output normalization:** Trim model output; if the final summary string is empty → return fallback `**Unable to generate response`** (for `summarizeText` string return).
3. **Token / response limits:** Set `**max_tokens`** on chat requests — target **~256** for summarize, **~200** for suggest-tasks — to cap response size (exact numbers can be constants in `ai.service.ts`).
4. **Suggestions safety:** After parsing, keep at most **10** items; **trim** each; **drop empties**; **dedupe**; final type always `**string[]`**.
5. **Safe JSON parsing:** `JSON.parse` only inside try/catch; on failure use newline (and bullet-stripping) fallback; never throw raw parse errors to the client.
6. **Error normalization (client-facing messages):** Map OpenAI failures so responses use only:
  - **429** → `**Rate limit exceeded`**
  - Timeouts / connection timeout → `**AI service unavailable`** (**503**)
  - Everything else → `**AI processing error`** (**503**)  
   Do **not** expose raw OpenAI or SDK error strings in JSON bodies.
7. **Logging (safe):** Optionally log operation kind (`summarize` vs `suggest`), duration, and **input length** only — never log the API key; avoid logging full user text (truncate or omit content).

- **Optional:** single private helper for shared chat + error mapping (still keeps “all OpenAI logic” inside this file).

## Notes: `[src/services/note.service.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\services\note.service.ts)`

- Prisma schema already has `summary`, `summaryModel`, `summaryUpdatedAt` on `[Note](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\prisma\schema.prisma)`; list/get DTOs currently omit `summaryModel` / `summaryUpdatedAt` in `[noteSelect](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\services\note.service.ts)` — **no need to change list/read contracts** for this phase if the summarize endpoint returns `**{ summary }` only** per spec.
- Add `**summarizeNoteForUser(userId, noteId): Promise<{ summary: string }>`**:
  1. Load note by `id` + `userId` (reuse ownership pattern from `getNoteById`); 404 if missing.
  2. `const summary = await summarizeText(note.content)` (import from `ai.service`).
  3. `prisma.note.update` set `summary`, `summaryModel: env.OPENAI_MODEL`, `summaryUpdatedAt: new Date()`.
  4. Return `{ summary }`.

## Routes

### New `[src/routes/ai.routes.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\routes\ai.routes.ts)`

- `router.use(authenticate)` (same as tasks/notes).
- Shared Zod body: `text: z.string().min(1).max(…)` — pick a **reasonable max** (e.g. **50_000** chars) for MVP.
- `**POST /summarize`** → validate → `summarizeText` → `**200 { summary }`**.
- `**POST /suggest-tasks`** → validate → `suggestTasks` → `**200 { suggestions: string[] }`**.

### `[src/routes/note.routes.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\routes\note.routes.ts)`

- Add `**POST /:id/summarize**` **above** existing `GET /:id`** so paths stay obvious (optional for POST-only, but good hygiene).
- Params: reuse `idParamSchema`; call `noteService.summarizeNoteForUser(req.userId!, params.id)`; return `**{ summary }`**.

### `[src/routes/index.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\routes\index.ts)`

- `router.use("/ai", aiRouter)` next to other mounts.

Full paths:

- `POST /api/v1/notes/:id/summarize`
- `POST /api/v1/ai/summarize`
- `POST /api/v1/ai/suggest-tasks`

## Security and “prepare for rate limiting”

- Key stays server-only via `env`; no new client-facing fields.
- Add a short **code comment** on AI routes (or `ai.service`) that per-user/IP rate limits should be added at middleware later—**no implementation** in this phase.

## Testing checklist (manual)

- Missing/invalid `OPENAI_API_KEY` → startup fails fast (Zod) or clear 503 on call depending on validation choice.
- `POST /api/v1/notes/:id/summarize` with valid JWT and note id → `200` + DB updated.
- Generic AI routes with huge body → **400** from Zod max length.

## Out of scope (explicit)

- Queues, Redis, background jobs, streaming responses.

