/**
 * BFF: POST /api/auth/refresh
 *
 * Rotates the session: presents the refresh cookie to the backend's
 * `POST /api/v1/auth/refresh` and stores the replacement pair as new cookies.
 *
 * The backend REVOKES the presented refresh token on every successful refresh
 * and treats a second use of a revoked token as theft, revoking every session
 * of the account (frontend-handover.md §1.3). Rotation is therefore
 * single-flight per process — concurrent callers share one in-flight rotation
 * instead of racing two.
 *
 * On a dead session both cookies are cleared and the backend's 401 envelope is
 * re-published, which the client treats as "signed out".
 */

import { NextResponse } from "next/server";

import { ApiError, toErrorEnvelope } from "@/lib/api/errors";
import { clearTokens, readTokens, rotateTokens, storeTokens } from "@/lib/auth/session";

export async function POST() {
  const { refresh } = await readTokens();
  if (!refresh) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "The session has expired." } },
      { status: 401 },
    );
  }

  try {
    const authed = await rotateTokens(refresh);
    await storeTokens(authed.tokens);
    return NextResponse.json({ user: authed.user });
  } catch (error) {
    await clearTokens();
    if (error instanceof ApiError) {
      return NextResponse.json(toErrorEnvelope(error), { status: error.status });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// GET — the render bridge
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/refresh?next=/notes
 *
 * Server Components cannot write cookies, so a render that meets an expired
 * access token cannot persist a rotated pair itself. Instead it redirects the
 * browser here: this Route Handler rotates, persists, and sends the user back
 * to `next`. This is what `withRenderAuth` bounces through, once per
 * access-token lifetime.
 *
 * `next` must be a relative in-app path — an open redirect is refused.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("next") ?? "/notes";
  // A relative in-app path only. `//host` is scheme-relative (an open
  // redirect); a leading `/\` is the same class of bypass against parsers
  // that treat a backslash as a slash — normalise it before the check, so
  // neither form can smuggle an authority in.
  const normalised = requested.replaceAll("\\", "/");
  const next =
    normalised.startsWith("/") && !normalised.startsWith("//")
      ? normalised
      : "/notes";

  const { refresh } = await readTokens();
  if (!refresh) {
    return NextResponse.redirect(new URL("/login", url));
  }

  try {
    const authed = await rotateTokens(refresh);
    await storeTokens(authed.tokens);
    return NextResponse.redirect(new URL(next, url));
  } catch {
    await clearTokens();
    return NextResponse.redirect(new URL("/login?expired=1", url));
  }
}
