# ATOM web

The web frontend of ATOM, a personal workspace platform. This is a **Phase-1
MVP**: authentication and notes, served as a thin BFF in front of the Rust API
(`atom/api`). The browser never talks to the backend directly and never holds a
credential — every backend call is made server-side by this Next.js app.

> **This directory is deliberately NOT a git repository.** `git init` and the
> first commit are awaiting owner authorization (see "Git setup" below).
> `create-next-app` ran `git init` automatically during scaffolding; that
> repository was immediately removed, and none has existed since.

## Purpose

- **Feature 1 — App shell:** responsive, accessible navigation with visible
  "not built yet" sections, loading/empty/error states.
- **Feature 2 — Authentication:** sign in, registration, sign out, session
  renewal — through an HttpOnly-cookie BFF (design below).
- **Feature 3 — Dashboard:** a real-data overview assembled from the existing
  list endpoints' first pages (recent notes, projects, sampled tasks with an
  honestly-labelled progress figure, recent claims and applications).
- **Feature 4 — Notes:** paginated list with the shared pagination envelope,
  full-text search, create, edit, delete, archive/unarchive via PATCH.
- **Feature 5 — Projects & tasks:** paginated, searchable project list with
  inline creation; project detail with edit, cascading delete, and the
  project's tasks (status/priority filters, create, edit, delete,
  done/reopen) in the backend's manual order.

Reimbursements, job applications and monitoring are still **not built** and
appear in the navigation only as disabled placeholders that go nowhere; the
dashboard reads their list endpoints for display only.

## Prerequisites

- Node.js 20.9+ (developed against Node 22.13, npm 10.9)
- A running ATOM API (`atom/api`): `cargo run --bin atom-api` with
  `DATABASE_URL`, `APP_JWT_SECRET` and `APP_ENV` configured per its AGENTS.md.
  The API serves `http://127.0.0.1:3000` locally.

## Setup

```bash
npm install
cp .env.example .env.local   # optional; the default URL matches local dev
npm run dev                  # http://localhost:3000
```

The only environment variable is:

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `ATOM_API_URL` | `http://127.0.0.1:3000` | The ATOM API base URL. **Server-side only** — the browser never calls the backend, so there is no `NEXT_PUBLIC_` variable. This is configuration, not a secret; no secret belongs in a client bundle. |

## Commands

```bash
npm run dev           # dev server (Turbopack)
npm run build         # production build
npm run start         # serve the production build
npm run lint          # ESLint (flat config, eslint-config-next)
npm run typecheck     # tsc --noEmit
npm test              # vitest unit tests
npm run openapi:types # regenerate src/lib/api/schema.d.ts from openapi.json
```

## The API contract

`openapi.json` is a **snapshot** of the backend's `GET /api/v1/openapi.json`,
captured once from a development instance (the document is not served in
production builds). From it, `openapi-typescript` generates
`src/lib/api/schema.d.ts`, and the client in `src/lib/api/client.ts` is generic
over those types — paths, request bodies and success responses are all
type-checked against the captured contract.

Regenerate deliberately after a backend contract change:

```bash
# 1. capture a fresh document from a running dev instance
curl -s http://127.0.0.1:3000/api/v1/openapi.json -o openapi.json
# 2. regenerate the types
npm run openapi:types
```

The generated types are necessary but not sufficient. Behaviour the document
cannot express is implemented by hand and pinned by unit tests:

- the error envelope `{error:{code,message,details?}}` mapped to a typed
  `ApiError`, with `details` omitted when empty and unknown codes never
  trusted (`src/lib/api/errors.ts`),
- the pagination envelope paged by the **applied** `limit`/`offset` and
  `has_more`, never by `total` (`src/lib/api/pagination.ts`),
- refresh rotation semantics: one rotation at a time, the replacement pair
  persisted immediately, a retry exactly once (`src/lib/auth/session.ts`).

## Auth design (BFF pattern)

```
Browser                    Next.js server                  ATOM API
  │  POST /api/auth/login      │                              │
  ├───────────────────────────►│  POST /api/v1/auth/login     │
  │                            ├─────────────────────────────►│
  │  200 {user}  + Set-Cookie  │◄───── AuthResponse ──────────┤
  │◄─── (HttpOnly, no tokens) ─┤                              │
  │                            │  Authorization: Bearer <at>  │
  │  page requests / actions   ├─────────────────────────────►│
  │◄───────────────────────────┤                              │
```

- The access and refresh tokens exist only inside **HttpOnly, SameSite=Lax
  cookies** (`atom_at`, `atom_rt`), set by Route Handlers under
  `src/app/api/auth/` — `Secure` when `NODE_ENV=production`.
- Server-side helpers (`src/lib/auth/session.ts`) read the cookies and attach
  `Authorization: Bearer <access>` to backend calls.
- On a 401 from the backend, a persistent context (route handler, server
  action) refreshes **once** and retries **once**. A Server Component render
  cannot write cookies, so instead of rotating inside a render it bounces the
  browser through `GET /api/auth/refresh?next=…`, a Route Handler that rotates,
  persists, and returns the user to where they were. This costs one extra
  round trip per 15-minute access-token lifetime and guarantees the rotated
  pair is never dropped.
- Rotation is **single-flight per process**: the backend revokes the presented
  refresh token on every refresh and treats reuse as theft (revoking every
  session of the account), so concurrent requests share one in-flight rotation
  rather than racing two.
- The refresh cookie's Max-Age mirrors the backend's committed
  `auth.refresh_token_ttl_seconds` (14 days). The TTL is not part of the API
  response; a deployment that changes that setting must change
  `REFRESH_COOKIE_MAX_AGE_SECONDS` in `src/lib/auth/cookies.ts` with it.
- Logout revokes the backend session (which needs both credentials) and clears
  both cookies, and always answers 200 — idempotent from the browser's view.
- A `403` is never treated as an expired session; it is an error state, not a
  refresh trigger.

### The XSS / storage trade-off

The obvious alternative is keeping tokens in `localStorage` (or memory) and
calling the API directly from the browser with `Authorization` headers. That
was rejected for this MVP:

- **Browser-held tokens are readable by any script that runs.** ATOM's own
  threat model accepts bearer-token risk (AR-2, KI-007) and defers the
  HttpOnly-cookie question (Q-02); a client that stores tokens in scriptable
  storage turns any XSS — in this app or any third-party script — into full
  account takeover for the lifetime of the refresh token (14 days). Cookies
  that JavaScript cannot read bound that blast radius to "drive the app while
  the cookie lives".
- **The BFF keeps the token out of every client code path.** No client
  component can read, log, exfiltrate or mishandle a token, because none ever
  sees one; the `server-only` boundary makes an accidental import of the
  token-handling modules a build error.
- **Server-side calls need no CORS.** The backend ships with CORS disabled
  (empty allowlist) and never enables credentials — correct for "not reachable
  from a browser". The BFF respects that posture instead of asking the
  operator to open it.
- **The cost, stated honestly:** cookies on cross-site navigations have CSRF
  exposure, mitigated here by `SameSite=Lax` (state-changing endpoints are
  POST/DELETE only, and mutation flows through server actions, which Next.js
  also protects with origin checks). The session can also be less long-lived
  than a raw refresh token if the cookie dies first. And a multi-instance BFF
  deployment would need a shared single-flight for rotation (the in-process
  mutex only protects one instance) — not a concern for a personal MVP.

## What is implemented vs. not

Implemented:

- [x] Typed API client generic over the generated OpenAPI schema (server-only)
- [x] Error-envelope mapping: stable codes, 422 FieldViolations, `body`
      pseudo-field fallback, `retry-after` on 429
- [x] Pagination-envelope handling (page by applied values, `has_more`)
- [x] BFF route handlers: `/api/auth/login|register|logout|refresh`
- [x] HttpOnly cookie session with single-flight rotation and
      refresh-once-retry-once
- [x] Protected layout guard, sign-in / registration / sign-out
- [x] Field-level form errors from the backend's 422 details
- [x] Notes: paginated list, search, create, edit, delete, archive/unarchive
- [x] Loading / empty / error states; accessible forms (labels,
      `aria-invalid`, focus-visible)
- [x] Navigation with honest "not built yet" placeholders
- [x] Dashboard: counts, recent items and task progress from first-page
      fetches only, with honest "of recent" labels; no invented endpoints
- [x] Projects: paginated list, search, create; detail with edit, delete
      (confirm) and the nested tasks module
- [x] Tasks: status/priority filters via query params, create, edit, delete,
      done/reopen via PATCH, server-side ordering preserved
- [x] Unit tests for the error envelope, pagination helpers, cookie options,
      task-progress helpers and task field guards

Explicitly **not** built (matching the plan's later features):

- [ ] Reimbursements
- [ ] Job applications
- [ ] ML note search (`POST /api/v1/notes/search`) — the list endpoint's
      `?search=` is lexical and is what the UI uses
- [ ] API keys UI
- [ ] Monitoring dashboards
- [ ] E2E/browser tests; multi-instance refresh coordination

## Git setup (intentionally not done)

This directory ships **without a git repository**, on purpose. When the owner
authorizes it, the intended first steps are:

```bash
git init
git add -A
git commit -m "feat: scaffold ATOM web MVP (auth BFF + notes)"
```

…after agreeing which repository it belongs to (a sibling of `atom/api`, likely
a workspace monorepo or its own repo) and adding a license decision. Nothing
here has been committed anywhere, and no remote exists.

## Dependencies

Runtime:

| Package | Why it exists |
| ------- | ------------- |
| `next`, `react`, `react-dom` | The framework and its renderer (App Router, server components, server actions). |
| `server-only` | A stub that turns any import of server modules (the token-handling client) from client code into a build error. |

Development only:

| Package | Why it exists |
| ------- | ------------- |
| `typescript` | Type checking; the whole point of the generated-schema approach. |
| `eslint`, `eslint-config-next` | Linting, per the task's base stack. |
| `@types/node`, `@types/react`, `@types/react-dom` | Types for the runtime environments. |
| `openapi-typescript` | Generates `schema.d.ts` from `openapi.json` — types without a runtime client library. |
| `vitest` | Light unit tests for the pure contract logic (envelope, pagination, cookies). |

Deliberately absent: TanStack Query (server components + server actions already
cover the handful of queries and mutations; a client cache would duplicate
state the server owns), any CSS framework (plain CSS + a token file, see
`src/app/globals.css`), and any API-client runtime library (a ~200-line typed
`fetch` wrapper is smaller and stricter than a generated client here).
