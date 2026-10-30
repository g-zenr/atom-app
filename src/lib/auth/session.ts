/**
 * Server-side session handling for the BFF.
 *
 * SERVER ONLY (tokens never reach client JavaScript).
 *
 * Design, against frontend-handover.md §1 in atom/api:
 * - The browser holds the two tokens ONLY as HttpOnly, SameSite=Lax cookies.
 * - Every backend call attaches `Authorization: Bearer <access>` server-side.
 * - On a 401 the client refreshes ONCE against `/api/v1/auth/refresh` and
 *   retries the original call once — never more (a 401 after a fresh token is
 *   not a token problem).
 * - Refresh ROTATES: the presented refresh token is revoked and a replacement
 *   pair is returned. The new pair must be persisted immediately; a lost
 *   replacement is a lock-out, and presenting the revoked token a second time
 *   revokes every session of the account. Rotation is therefore single-flight
 *   per process: concurrent callers awaiting the same refresh token share one
 *   in-flight rotation instead of racing two.
 *
 * Two strategies, because Next.js only allows cookie writes in Route Handlers
 * and Server Actions:
 * - `withAuth` — persistent contexts (route handlers, server actions). It
 *   rotates and persists the new pair, then retries.
 * - `withRenderAuth` — Server Component renders, which CANNOT set cookies. It
 *   never rotates; on a 401 it bounces the browser through
 *   `GET /api/auth/refresh?next=…`, a Route Handler that persists the rotated
 *   pair and sends the user back. This costs one extra round trip per 15-minute
 *   access-token lifetime and guarantees the replacement is never dropped.
 */

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  meRequest,
  refreshRequest,
  type AuthResponse,
  type TokenPair,
  type UserResponse,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  cookieBaseOptions,
} from "@/lib/auth/cookies";

// ---------------------------------------------------------------------------
// Cookie I/O
// ---------------------------------------------------------------------------

export interface StoredTokens {
  access?: string;
  refresh?: string;
}

/** Reads the session cookies, if present. */
export async function readTokens(): Promise<StoredTokens> {
  const store = await cookies();
  return {
    access: store.get(ACCESS_COOKIE)?.value,
    refresh: store.get(REFRESH_COOKIE)?.value,
  };
}

/** True when the value looks like the token pair the API issues. Responses are untrusted input. */
export function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== "object" || value === null) return false;
  const pair = value as Record<string, unknown>;
  return (
    typeof pair.access_token === "string" &&
    pair.access_token.length > 0 &&
    typeof pair.refresh_token === "string" &&
    pair.refresh_token.length > 0
  );
}

/** Fallback matching the backend's committed `auth.access_token_ttl_seconds`. */
const DEFAULT_ACCESS_TTL_SECONDS = 900;

/** Persists a token pair as two HttpOnly cookies. Route Handlers and Server Actions only. */
export async function storeTokens(tokens: TokenPair): Promise<void> {
  if (!isTokenPair(tokens)) {
    throw new ApiError(502, "internal_error", "The ATOM API returned an unusable token response.");
  }
  const store = await cookies();
  const base = cookieBaseOptions();
  const accessTtl =
    typeof tokens.expires_in === "number" && tokens.expires_in > 0
      ? tokens.expires_in
      : DEFAULT_ACCESS_TTL_SECONDS;
  store.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: accessTtl });
  store.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...base,
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
}

/** Removes both session cookies. */
export async function clearTokens(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

// ---------------------------------------------------------------------------
// Single-flight rotation
// ---------------------------------------------------------------------------

let inFlightRotation: { refreshToken: string; promise: Promise<AuthResponse> } | null = null;

/**
 * Exchanges a refresh token for a new pair, sharing one in-flight request per
 * process. Throws `ApiError` (401) when the session is dead.
 */
export function rotateTokens(refreshToken: string): Promise<AuthResponse> {
  const current = inFlightRotation;
  if (current && current.refreshToken === refreshToken) {
    return current.promise;
  }
  const promise = refreshRequest(refreshToken).finally(() => {
    if (inFlightRotation?.promise === promise) inFlightRotation = null;
  });
  inFlightRotation = { refreshToken, promise };
  return promise;
}

// ---------------------------------------------------------------------------
// Session-lifecycle errors
// ---------------------------------------------------------------------------

/** Thrown when no credential can be established at all. */
export class SessionExpiredError extends Error {
  constructor() {
    super("The session has expired.");
    this.name = "SessionExpiredError";
  }
}

// ---------------------------------------------------------------------------
// Strategy 1: persistent contexts (Route Handlers, Server Actions)
// ---------------------------------------------------------------------------

/**
 * Runs `run` with an access token, refreshing once and retrying once on a 401.
 * Persists every rotated pair. Throws `SessionExpiredError` when the session
 * is dead; the caller decides how to present that (redirect, 401 body, …).
 */
export async function withAuth<T>(run: (accessToken: string) => Promise<T>): Promise<T> {
  const { access, refresh } = await readTokens();

  if (access) {
    try {
      return await run(access);
    } catch (error) {
      // Refresh only on "session expired"; a 403 or a 500 must not trigger it.
      if (!(error instanceof ApiError) || !error.isUnauthorized || !refresh) throw error;
    }
  } else if (!refresh) {
    throw new SessionExpiredError();
  }

  // Exactly one rotation, then exactly one retry.
  const authed = await rotateTokens(refresh);
  await storeTokens(authed.tokens);
  return run(authed.tokens.access_token);
}

/** Resolves a `SessionExpiredError` thrown inside an action into a redirect. */
export function rethrowSession<T>(error: unknown): T {
  if (error instanceof SessionExpiredError) redirect("/login");
  throw error;
}

// ---------------------------------------------------------------------------
// Strategy 2: Server Component renders (no cookie writes)
// ---------------------------------------------------------------------------

/**
 * Like `withAuth`, for rendering: runs `run` with the access cookie. A 401 (or
 * a missing access cookie with a refresh cookie present) bounces the browser
 * through the refresh Route Handler, which persists the rotated pair and
 * returns to `nextPath`. No rotation ever happens inside a render.
 */
export async function withRenderAuth<T>(
  nextPath: string,
  run: (accessToken: string) => Promise<T>,
): Promise<T> {
  const { access, refresh } = await readTokens();
  if (!access && !refresh) redirect("/login");

  if (access) {
    try {
      return await run(access);
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized && refresh) {
        redirect(`/api/auth/refresh?next=${encodeURIComponent(nextPath)}`);
      }
      throw error;
    }
  }

  redirect(`/api/auth/refresh?next=${encodeURIComponent(nextPath)}`);
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

/**
 * The signed-in user for the navigation shell, or `null`.
 *
 * Best-effort by design: the layout renders on every request and cannot write
 * cookies, so a failed `/auth/me` degrades to "no user chip" instead of
 * redirecting. Page-level calls enforce the session for real.
 */
export async function loadShellUser(): Promise<UserResponse | null> {
  const { access } = await readTokens();
  if (!access) return null;
  try {
    return await meRequest(access);
  } catch {
    return null;
  }
}
