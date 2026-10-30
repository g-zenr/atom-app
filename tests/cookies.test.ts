import { afterEach, describe, expect, it } from "vitest";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  cookieBaseOptions,
} from "../src/lib/auth/cookies";

const originalNodeEnv = process.env.NODE_ENV;

/** @types/node types NODE_ENV as read-only; tests legitimately swap it. */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  setNodeEnv(originalNodeEnv ?? "test");
});

describe("cookieBaseOptions", () => {
  it("always sets HttpOnly, SameSite=Lax and a site-wide path", () => {
    const options = cookieBaseOptions("development");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("is Secure only in production", () => {
    expect(cookieBaseOptions("production").secure).toBe(true);
    expect(cookieBaseOptions("development").secure).toBe(false);
    expect(cookieBaseOptions("test").secure).toBe(false);
  });

  it("defaults to the ambient NODE_ENV", () => {
    setNodeEnv("production");
    expect(cookieBaseOptions().secure).toBe(true);
  });
});

describe("cookie names", () => {
  it("uses two distinct HttpOnly cookies for the two tokens", () => {
    expect(ACCESS_COOKIE).not.toBe(REFRESH_COOKIE);
    expect(ACCESS_COOKIE).toMatch(/^atom_/);
    expect(REFRESH_COOKIE).toMatch(/^atom_/);
  });

  it("matches the backend's committed refresh lifetime (14 days)", () => {
    // auth.refresh_token_ttl_seconds = 1209600 in config/auth.toml. The cookie
    // must not outlive (or die before) the session it carries.
    expect(REFRESH_COOKIE_MAX_AGE_SECONDS).toBe(1_209_600);
  });
});
