/**
 * BFF: POST /api/auth/register
 *
 * Proxies the backend's `POST /api/v1/auth/register` (which answers 201) and
 * stores the issued pair as HttpOnly cookies, exactly like login. The
 * backend's 422 FieldViolations (password policy, email shape, display name)
 * are re-published verbatim for field-level display.
 */

import { NextResponse, type NextRequest } from "next/server";

import { registerRequest } from "@/lib/api/client";
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

  const body = payload as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.display_name === "string" ? body.display_name : "";
  const missing = [
    ...(email.length === 0 ? [{ field: "email", message: "Email is required." }] : []),
    ...(password.length === 0 ? [{ field: "password", message: "Password is required." }] : []),
    ...(displayName.length === 0
      ? [{ field: "display_name", message: "Display name is required." }]
      : []),
  ];
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "validation_failed",
          message: "All fields are required.",
          details: missing,
        },
      },
      { status: 422 },
    );
  }

  try {
    const authed = await registerRequest(email, password, displayName);
    if (!isTokenPair(authed?.tokens)) {
      throw new ApiError(502, "internal_error", "The ATOM API returned an unusable response.");
    }
    await storeTokens(authed.tokens);
    return NextResponse.json({ user: authed.user }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(toErrorEnvelope(error), { status: error.status });
    }
    throw error;
  }
}
