/**
 * Typed fetch client for the ATOM API.
 *
 * SERVER ONLY. This module reads the backend URL from the environment and
 * carries bearer tokens; `import "server-only"` makes any accidental import
 * from a Client Component a build error. The browser never talks to the
 * backend directly (see README.md — BFF pattern).
 *
 * The types come from the generated OpenAPI schema (`schema.d.ts`), generated
 * from the snapshot in `openapi.json` (see README.md "Regenerating the API
 * types"). Responses are still treated as untrusted input at runtime.
 *
 * Error mapping follows `docs/api/error-contract.md`: every non-2xx is
 * rejected as an `ApiError` carrying the envelope's stable `code`.
 */

import "server-only";

import type { components, paths } from "./schema";
import { ApiError, parseErrorEnvelope } from "./errors";
import { buildQuery, type QueryValue } from "./pagination";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Fallback for local development; a deployment sets ATOM_API_URL. */
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3000";

/** The backend URL. Server-side configuration, not a secret. */
export function backendUrl(): string {
  const raw = process.env.ATOM_API_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/+$/, "") : DEFAULT_BACKEND_URL;
}

/** Slightly above the backend's own 30 s request timeout. */
const BACKEND_TIMEOUT_MS = 35_000;

// ---------------------------------------------------------------------------
// Generic extraction over the generated schema
// ---------------------------------------------------------------------------

export type HttpMethod = "get" | "post" | "patch" | "delete";

/** Paths whose operation object declares the given method. */
export type ApiPath<M extends HttpMethod> = {
  [P in keyof paths]-?: [paths[P][M]] extends [undefined] ? never : P;
}[keyof paths];

type Operation<P extends ApiPath<M>, M extends HttpMethod> = Extract<paths[P][M], object>;

type JsonResponse<S> = S extends { content: { "application/json": infer T } } ? T : never;

type ResponseAt<R, S extends number> = S extends keyof R ? R[S] : never;

/** The success body of an operation (200 or 201); `never` for 204-only operations. */
export type ApiSuccessBody<P extends ApiPath<M>, M extends HttpMethod> =
  | JsonResponse<ResponseAt<Operation<P, M>["responses"], 200>>
  | JsonResponse<ResponseAt<Operation<P, M>["responses"], 201>>;

/** The JSON request body of an operation, or `undefined` when it takes none. */
export type ApiRequestBody<P extends ApiPath<M>, M extends HttpMethod> =
  Operation<P, M> extends { requestBody: { content: { "application/json": infer T } } }
    ? T
    : undefined;

/** The declared query parameters of an operation. */
export type ApiQuery<P extends ApiPath<M>, M extends HttpMethod> =
  Operation<P, M>["parameters"] extends { query?: infer Q } ? Q : undefined;

// ---------------------------------------------------------------------------
// Re-exported contract types (what the UI works with)
// ---------------------------------------------------------------------------

export type AuthResponse = components["schemas"]["AuthResponse"];
export type TokenPair = components["schemas"]["TokenPair"];
export type UserResponse = components["schemas"]["UserResponse"];
export type NoteResponse = components["schemas"]["NoteResponse"];
export type NotePage = components["schemas"]["NotePage"];
export type CreateNoteRequest = components["schemas"]["CreateNoteRequest"];
export type UpdateNoteRequest = components["schemas"]["UpdateNoteRequest"];
export type Pagination = components["schemas"]["Pagination"];

// ---------------------------------------------------------------------------
// The generic request function
// ---------------------------------------------------------------------------

type Primitive = string | number | boolean;

interface RequestOptions {
  /** Path parameters, substituted into `{placeholders}` of the path. */
  params?: Record<string, Primitive>;
  /** Query parameters. `undefined`, `null` and the empty string are omitted. */
  query?: Record<string, QueryValue>;
  /** JSON request body. */
  body?: unknown;
  /** Bearer credential for private endpoints (access token or API key). */
  token?: string;
}

function buildUrl(
  path: string,
  params: Record<string, Primitive> | undefined,
  query: Record<string, QueryValue> | undefined,
): string {
  let resolved = path;
  for (const [key, value] of Object.entries(params ?? {})) {
    resolved = resolved.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  const search = new URLSearchParams(buildQuery(query ?? {}));
  const qs = search.toString();
  return `${backendUrl()}${resolved}${qs.length > 0 ? `?${qs}` : ""}`;
}

/**
 * Performs one request against the backend and returns the success body
 * (or `null` for a 204). Rejects with `ApiError` for every non-2xx.
 */
export async function apiFetch<P extends ApiPath<M>, M extends HttpMethod>(
  method: M,
  path: P,
  options: RequestOptions = {},
): Promise<ApiSuccessBody<P, M> | null> {
  const url = buildUrl(path, options.params, options.query);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token !== undefined && options.token.length > 0) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    // Network failure, DNS failure or timeout. The backend is unreachable —
    // not an application error of the caller.
    throw new ApiError(503, "internal_error", "The ATOM API is unreachable.", [], undefined, {
      cause: error,
    });
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload: unknown = undefined;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const retryAfterRaw = response.headers.get("retry-after");
    const retryAfter =
      response.status === 429 && retryAfterRaw !== null && Number.isInteger(Number(retryAfterRaw))
        ? Math.max(1, Number(retryAfterRaw))
        : undefined;
    throw parseErrorEnvelope(
      response.status,
      payload,
      `The request failed (HTTP ${response.status}).`,
      retryAfter,
    );
  }

  // A 2xx that declares a JSON body must parse as JSON; anything else on a
  // success status is treated as an untrusted, unusable response.
  if (text.length === 0) return null;
  if (payload === undefined) {
    throw new ApiError(response.status, "internal_error", "The ATOM API returned an unusable response.");
  }
  return payload as ApiSuccessBody<P, M>;
}

// ---------------------------------------------------------------------------
// Operation wrappers — auth
// ---------------------------------------------------------------------------

export function loginRequest(email: string, password: string): Promise<AuthResponse> {
  return apiFetch("post", "/api/v1/auth/login", { body: { email, password } }) as Promise<AuthResponse>;
}

export function registerRequest(
  email: string,
  password: string,
  display_name: string,
): Promise<AuthResponse> {
  return apiFetch("post", "/api/v1/auth/register", {
    body: { email, password, display_name },
  }) as Promise<AuthResponse>;
}

/** The only rotation endpoint. Callers must persist the returned pair — the presented token is revoked. */
export function refreshRequest(refresh_token: string): Promise<AuthResponse> {
  return apiFetch("post", "/api/v1/auth/refresh", { body: { refresh_token } }) as Promise<AuthResponse>;
}

/** Logout needs both credentials: the bearer access token and the refresh token in the body. */
export function logoutRequest(accessToken: string, refresh_token: string): Promise<null> {
  return apiFetch("post", "/api/v1/auth/logout", {
    token: accessToken,
    body: { refresh_token },
  }) as Promise<null>;
}

export function meRequest(accessToken: string): Promise<UserResponse> {
  return apiFetch("get", "/api/v1/auth/me", { token: accessToken }) as Promise<UserResponse>;
}

// ---------------------------------------------------------------------------
// Operation wrappers — notes
// ---------------------------------------------------------------------------

export type ListNotesQuery = NonNullable<ApiQuery<"/api/v1/notes", "get">>;

export function listNotes(query: ListNotesQuery, accessToken: string): Promise<NotePage> {
  return apiFetch("get", "/api/v1/notes", { query, token: accessToken }) as Promise<NotePage>;
}

export function createNote(body: CreateNoteRequest, accessToken: string): Promise<NoteResponse> {
  return apiFetch("post", "/api/v1/notes", { body, token: accessToken }) as Promise<NoteResponse>;
}

export function getNote(noteId: string, accessToken: string): Promise<NoteResponse> {
  return apiFetch("get", "/api/v1/notes/{note_id}", {
    params: { note_id: noteId },
    token: accessToken,
  }) as Promise<NoteResponse>;
}

/**
 * PATCH is partial: only send the fields that changed. Never send `null` —
 * an omitted key is what leaves a stored value untouched.
 */
export function updateNote(
  noteId: string,
  body: UpdateNoteRequest,
  accessToken: string,
): Promise<NoteResponse> {
  return apiFetch("patch", "/api/v1/notes/{note_id}", {
    params: { note_id: noteId },
    body,
    token: accessToken,
  }) as Promise<NoteResponse>;
}

export function deleteNote(noteId: string, accessToken: string): Promise<null> {
  return apiFetch("delete", "/api/v1/notes/{note_id}", {
    params: { note_id: noteId },
    token: accessToken,
  }) as Promise<null>;
}
