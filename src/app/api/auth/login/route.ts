/**
 * BFF: POST /api/auth/login
 *
 * Proxies the backend's `POST /api/v1/auth/login` and converts the issued
 * token pair into two HttpOnly session cookies. The browser never sees the
 * tokens — the response body carries the public user only.
 *
 * The backend's error envelope is re-published verbatim (same status, same
 * shape), so the login form can render 422 field violations next to the
 * inputs and 401 as "wrong email or password".
 */

import { NextResponse, type NextRequest } from "next/server";

import { loginRequest } from "@/lib/api/client";
import { ApiError, toErrorEnvelope } from "@/lib/api/errors";
import { isTokenPair, storeTokens } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "The request body must be JSON." } },
      { status: 400 },
    );
  }

  // Transport-level shape check only; the backend owns every business rule.
  const body = payload as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (email.length === 0 || password.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "validation_failed",
          message: "Email and password are required.",
          details: [
            ...(email.length === 0 ? [{ field: "email", message: "Email is required." }] : []),
            ...(password.length === 0
              ? [{ field: "password", message: "Password is required." }]
              : []),
          ],
        },
      },
      { status: 422 },
    );
  }

  try {
    const authed = await loginRequest(email, password);
    if (!isTokenPair(authed?.tokens)) {
      throw new ApiError(502, "internal_error", "The ATOM API returned an unusable response.");
    }
    await storeTokens(authed.tokens);
    // Tokens are in the cookies; the body carries the public user only.
    return NextResponse.json({ user: authed.user });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(toErrorEnvelope(error), { status: error.status });
    }
    throw error;
  }
}
