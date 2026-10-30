/**
 * Client-side helper for the BFF auth endpoints.
 *
 * This module is safe for Client Components: it contains no tokens and no
 * server-only imports. The fetches go to THIS app's route handlers
 * (/api/auth/…), never to the backend — the HttpOnly cookies are set by the
 * handler response and are invisible to this code.
 */

import { parseErrorEnvelope, type FieldViolation } from "@/lib/api/errors";

export interface AuthFormResult {
  ok: boolean;
  error?: {
    status: number;
    code: string;
    message: string;
    details: FieldViolation[];
  };
}

/**
 * Posts a JSON body to a BFF auth endpoint and maps the standard error
 * envelope onto a form-usable result. Network failures (backend down) are
 * surfaced as a generic error, not an exception.
 */
export async function submitAuthForm(
  endpoint: "/api/auth/login" | "/api/auth/register",
  body: Record<string, string>,
  signal?: AbortSignal,
): Promise<AuthFormResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return {
      ok: false,
      error: {
        status: 0,
        code: "network_error",
        message: "Could not reach the server. Check that the ATOM API is running.",
        details: [],
      },
    };
  }

  if (response.ok) return { ok: true };

  // Every non-2xx of the BFF carries the standard envelope (or nothing at
  // all — parseErrorEnvelope degrades to a generic internal error).
  let payload: unknown = undefined;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const apiError = parseErrorEnvelope(
    response.status,
    payload,
    "Sign-in failed. Please try again.",
  );
  return {
    ok: false,
    error: {
      status: apiError.status,
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    },
  };
}
