---
name: Clario Expo mobile foundation
overview: Scaffold apps/mobile (Expo, TypeScript, Expo Router) with design tokens, Axios + safe AsyncStorage, and AuthContext—with strict hydration loading, token/axios sync, normalized API errors, and config-driven base URL. Navigation shells and placeholder routes only; no feature UI screens (Login UI deferred).
todos:
  - id: scaffold-expo
    content: Create apps/mobile with Expo (TS), expo-router, axios, AsyncStorage, app.json name Clario
    status: completed
  - id: folders-theme-config
    content: Add app/(auth), app/(tabs), styles/theme.ts, constants/config.ts (EXPO_PUBLIC_API_BASE_URL + fallback + comments)
    status: completed
  - id: storage-api
    content: utils/storage.ts (safe get/set/clear); services/api.ts (interceptors, setAuthToken before /me, error normalization helper)
    status: completed
  - id: auth-context
    content: AuthContext with hydration isLoading contract, token order, logout clearing storage+axios+user; thin API wrappers in services if needed
    status: completed
  - id: router-index-loading
    content: app/_layout.tsx, app/index.tsx with ActivityIndicator while isLoading; Redirect when ready; placeholder auth/tabs screens only
    status: completed
  - id: login-prep-no-ui
    content: Document or minimal non-UI prep for login (trim/empty guard pattern, state shape)—no full login screen
    status: completed
isProject: false
---

# Clario mobile app — foundation (refined)

## Backend alignment (existing API)

Use these contracts from `[apps/api/src/routes/auth.routes.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\routes\auth.routes.ts)` and `[apps/api/src/services/auth.service.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\services\auth.service.ts)`:


| Action       | Method / path             | Body / headers                  | Success body                             |
| ------------ | ------------------------- | ------------------------------- | ---------------------------------------- |
| Login        | `POST /api/v1/auth/login` | `{ email, password }`           | `{ token: string, user: { id, email } }` |
| Current user | `GET /api/v1/me`          | `Authorization: Bearer <token>` | `{ user: { id, email, name, ... } }`     |


Password minimum on server: **8** characters.

---

## 1. Create the Expo app (new package)

- Add `**apps/mobile`** via Expo Router setup (latest stable Expo SDK + TypeScript) and peer deps per Expo docs.
- App name/slug: **Clario**.
- Dependencies: `axios`, `@react-native-async-storage/async-storage`.

---

## 2. Folder structure (unchanged)

Target layout under `[apps/mobile](c:\Users\AshJo\Documents\GitHub\Clario\apps\mobile)`:

- `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/(tabs)/_layout.tsx` + tab route files — **placeholders only** (no polished UI in this phase).
- `services/api.ts`, `context/AuthContext.tsx`, `utils/storage.ts`, `constants/config.ts`, `styles/theme.ts`, optional `hooks/`.

**Do not** change the agreed route groups or file paths; **do not** add new features beyond this foundation.

---

## 3. Micro-improvements (required)

### 3.1 Auth loading state (important)

`**[context/AuthContext.tsx](apps/mobile/context/AuthContext.tsx)`**

- Expose `**isLoading`**: `true` from provider mount until **hydration completes** (restore token + optional `/me`).
- Flow: start with `isLoading === true` → read token from storage → `**setAuthToken(token)`** (see §3.2) → if token present call `**GET /me`** → set user or clear session on failure → `**isLoading === false**` only after this sequence finishes (success or cleared).

`**[app/index.tsx](apps/mobile/app/index.tsx)**`

- If `**isLoading**`: render a **simple loading UI** — centered `**ActivityIndicator`** (and optional short text). **Do not** render `Redirect` until `isLoading` is false, to **avoid flicker** between auth and tabs.
- When `!isLoading`: `Redirect` to `/(tabs)` if authenticated, else `/(auth)/login` (unchanged behavior).

### 3.2 Token synchronization

On app load (hydrate):

1. Read token from AsyncStorage (via safe helpers).
2. Call `**setAuthToken(token | null)`** in `**services/api.ts`** **before** any authenticated request so the axios interceptor attaches `**Authorization`** for `**GET /me`**.

On **logout** (single place, e.g. context calling helpers):

- Clear AsyncStorage token (`clearToken`).
- `**setAuthToken(null)`** so axios no longer sends a header.
- Reset `**user`** (and any in-memory token mirror) to logged-out state.

Avoid duplicating HTTP calls: **services** own raw `axios` calls; **context** orchestrates storage + `setAuthToken` + state.

### 3.3 API error normalization

`[services/api.ts](apps/mobile/services/api.ts)`

- Add a small helper (e.g. `getApiErrorMessage(error)`) for context/UI.
- Clario API (`[apps/api/src/middleware/errorHandler.ts](c:\Users\AshJo\Documents\GitHub\Clario\apps\api\src\middleware\errorHandler.ts)`) responds with `**{ error: { message: string, code?: string } }`**. Use:
  - `**error.response?.data?.error?.message**` as the primary string.
- Fallback: `**"Something went wrong"**`.
- One pattern only (helper, optionally plus response interceptor); no duplicate extraction in context.

### 3.4 Base URL configuration

`**[constants/config.ts](apps/mobile/constants/config.ts)`**

- Read `**process.env.EXPO_PUBLIC_API_BASE_URL`**.
- **Fallback:** `http://localhost:3000/api/v1`.
- **Comment block** in file explaining:
  - **Android emulator:** often `http://10.0.2.2:3000/api/v1`
  - **iOS simulator:** `http://localhost:3000/api/v1`
  - **Physical device:** host machine **LAN IP**, same path `/api/v1`

### 3.5 Login input UX preparation (no full Login UI)

**Do not** build the Login screen UI in this phase.

Prepare for a later step:

- **Helpers or documented pattern:** `trim()` email before submit; **block submit** if email or password is empty.
- **Intended component state shape** (when UI is built): `email`, `password`, `loading`, `error`.

Until then, `[app/(auth)/login.tsx](apps/mobile/app/(auth)`/login.tsx) remains a **minimal placeholder** (e.g. single `Text`), not a styled form.

### 3.6 Safe storage helpers

`**[utils/storage.ts](apps/mobile/utils/storage.ts)`**

- `getToken`, `setToken`, `clearToken` wrap AsyncStorage with `**try/catch`**.
- On failure: return `null` / no-op clear as appropriate; **do not** throw uncaught errors to the root (log optional).

### 3.7 Code cleanup — separation of concerns

- `**services/`** — HTTP: login request, getMe, axios instance, `setAuthToken`, error normalization helper.
- `**context/`** — Session: `user`, `isLoading`, `isAuthenticated`, orchestrate hydrate/login/logout (call services + storage + `setAuthToken`).
- `**app/**` — Routing and thin presentation for loading gate; **no** axios imports in route files if avoidable.

---

## 4. Design system — `[styles/theme.ts](apps/mobile/styles/theme.ts)`

Unchanged intent: spacing scale (8/12/16/24), radius 16, typography roles, neutral + one accent, soft shadows. Used when UI is built later.

---

## 5. Expo Router (structure only)

- Root `**app/_layout.tsx`**: `AuthProvider` + router shell.
- `**app/index.tsx`**: loading gate + redirects (§3.1).
- `**(auth)` / `(tabs)**`: layouts + **placeholder** screens only.

**No** navigation structure changes beyond what is already planned.

---

## 6. Verification

- Cold start: loading indicator until hydration completes; then redirect without flash.
- Logout clears storage and subsequent requests lack `Authorization`.
- Wrong API URL surfaces normalized message via helper.

---

## Scope boundaries (updated)

- **In scope:** scaffolding, theme file, config, safe storage, api client + error helper, AuthContext with loading/hydration/token order, `**app/index.tsx`** loading UI, placeholder routes.
- **Out of scope for this phase:** full Login/Register UI, tab feature UIs, new product features.

---

## Output (when implementing)

Deliverables to review first:


| File                                                             | Notes                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| `[context/AuthContext.tsx](apps/mobile/context/AuthContext.tsx)` | `isLoading`, hydrate order, logout                     |
| `[services/api.ts](apps/mobile/services/api.ts)`                 | baseURL from config, `setAuthToken`, normalized errors |
| `[app/index.tsx](apps/mobile/app/index.tsx)`                     | `ActivityIndicator` while loading; then `Redirect`     |
| `[utils/storage.ts](apps/mobile/utils/storage.ts)`               | safe async storage                                     |


Keep explanations minimal in PR/commit text.