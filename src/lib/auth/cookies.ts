/**
 * Cookie names and options for the BFF session.
 *
 * Pure module (no Next.js runtime), so the options are unit-testable. The
 * tokens themselves never leave HttpOnly cookies — see README.md, "Auth
 * design" for the trade-offs this accepts.
 */

export const ACCESS_COOKIE = "atom_at";
export const REFRESH_COOKIE = "atom_rt";

/**
 * Max-Age of the refresh cookie, in seconds.
 *
 * The refresh token's own TTL is deliberately NOT part of the API response
 * (frontend-handover.md §1.1). The committed backend default is
 * `auth.refresh_token_ttl_seconds` = 1 209 600 s (14 days). A deployment that
 * changes that setting must change this constant with it — the cookie would
 * otherwise outlive (or die before) the session it carries.
 */
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export interface CookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
}

/** Base options for both session cookies. `Secure` in production only. */
export function cookieBaseOptions(nodeEnv: string = process.env.NODE_ENV): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path: "/",
  };
}
