/**
 * BFF: POST /api/auth/logout
 *
 * Revokes the backend session and clears both cookies. The backend's logout
 * needs BOTH credentials — the bearer access token and the refresh token in
 * the body (frontend-handover.md §1.4). When the access token has already
 * expired, the pair is rotated once first so the revocation call can
 * authenticate; if even that fails, the client-side discard is all that is
 * left, and the refresh session dies at its own TTL — the handover accepts
 * exactly that.
 *
 * Always answers 200 and clears the cookies: from the browser's point of view
 * logout is idempotent, even when the backend session was already gone.
 */

import { NextResponse } from "next/server";

import { logoutRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { clearTokens, isTokenPair, readTokens, rotateTokens } from "@/lib/auth/session";

export async function POST() {
  const { access, refresh } = await readTokens();

  if (refresh) {
    try {
      if (access) {
        await logoutRequest(access, refresh);
      } else {
        throw new ApiError(401, "unauthorized", "No access token.");
      }
    } catch (error) {
      // One rotation to get a valid bearer, then one revocation attempt.
      // Any other outcome falls through to the local discard.
      if (error instanceof ApiError && error.isUnauthorized) {
        try {
          const authed = await rotateTokens(refresh);
          if (isTokenPair(authed?.tokens)) {
            // The rotated pair is used in-process only — the cookies are
            // cleared below either way. Logging out with the NEW refresh
            // token revokes the CURRENT session, which owns that token.
            await logoutRequest(authed.tokens.access_token, authed.tokens.refresh_token);
          }
        } catch {
          // The session could not be revoked server-side. The local discard
          // below is the accepted fallback; the refresh session dies at its TTL.
        }
      }
    }
  }

  await clearTokens();
  return NextResponse.json({ ok: true });
}
