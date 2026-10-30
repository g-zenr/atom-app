import type { NextConfig } from "next";

/**
 * `create-next-app` scaffolded this file with `cacheComponents: true` and
 * `partialPrefetching: true` (the latter requires the former). Both are
 * deliberately removed:
 *
 * The Cache Components model requires every request-time read (here: the
 * session cookies on every authenticated page) to be wrapped in Suspense
 * boundaries or `use cache`, which the cookie-authenticated BFF in this MVP
 * does not want — pages are rendered per request, on purpose. Removing the
 * flag restores standard dynamic rendering. Revisit when adopting Cache
 * Components deliberately.
 */
const nextConfig: NextConfig = {
  // Pin the workspace root: a lockfile in a parent directory (the user's home)
  // otherwise makes Turbopack infer the wrong root and scan upward.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
