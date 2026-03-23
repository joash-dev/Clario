---
name: Phase 1 API refinements
overview: Add request logging, CORS (allow all), and mount existing routers under `/api/v1` so health is `GET /api/v1/health`, without adding auth or new features.
todos:
  - id: deps-cors
    content: Add cors and @types/cors to apps/api
    status: completed
  - id: logger-mw
    content: Create src/middleware/logger.ts (typed RequestHandler)
    status: completed
  - id: app-wire
    content: "Update app.ts: CORS, json, logger, mount apiRouter at /api/v1"
    status: completed
isProject: false
---

# Phase 1 backend refinements (logging, CORS, `/api/v1`)

## Scope

- Touch: `[apps/api/package.json](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\package.json)` (add `cors` + `@types/cors`), new `[apps/api/src/middleware/logger.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\middleware\logger.ts)`, `[apps/api/src/app.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\app.ts)`.
- **No changes required** to `[health.routes.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\routes\health.routes.ts)` or `[routes/index.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\routes\index.ts)` if the version prefix is applied only in `app.ts` via `app.use("/api/v1", apiRouter)` — health stays `router.get("/health", ...)`, resolving to `**GET /api/v1/health`**.

## Middleware order in `createApp()`

1. `cors({ origin: true })` — allow all origins for MVP (`origin: true` reflects request origin; alternative is `origin: "*"` with default options; both satisfy “allow all” for typical dev).
2. `express.json()`
3. `**requestLogger`** (new) — logs before the `/api/v1` router so each request is logged once with full path.
4. `app.use("/api/v1", apiRouter)`
5. `notFound` then `errorHandler` (unchanged)

## 1. `src/middleware/logger.ts`

- Export a `RequestHandler` named e.g. `requestLogger`.
- Use `Request`, `Response`, `NextFunction` from `express`.
- Build timestamp in local time: `YYYY-MM-DD HH:mm:ss` via `toISOString()` slice or `Intl` / manual pad — keep dependency-free.
- Log format: `[timestamp] METHOD URL` using `**req.method**` and `**req.originalUrl**` (includes query string if present; matches “URL” intent).

## 2. CORS

- Run: `npm install cors` and `npm install -D @types/cors` in `[apps/api](c:\Users\AshJo\Documents\GitHub\Clario\apps\api)`.
- `import cors from "cors"` in `app.ts`, apply as first middleware.

## 3. `app.ts` changes

- Import `requestLogger` from `./middleware/logger`.
- Apply stack as in the order above; mount `apiRouter` at `**/api/v1**` only (remove unscoped `app.use(apiRouter)`).

## 4. Verification

- `GET http://localhost:PORT/api/v1/health` → `{"status":"ok"}`; console shows e.g. `[2026-03-22 12:00:00] GET /api/v1/health`.
- `GET /health` (no prefix) → 404 JSON from existing `notFound` (expected).

## Out of scope

- Auth, rate limiting, structured logging libraries, request IDs — not added.

