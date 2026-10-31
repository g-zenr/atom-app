/**
 * `/` — entry point. Sends signed-in visitors to the dashboard and everyone
 * else to the sign-in screen. The cookie check is presence-only; the real
 * validation happens against the backend on the first data call.
 */

import { redirect } from "next/navigation";

import { readTokens } from "@/lib/auth/session";

export default async function HomePage() {
  const { access, refresh } = await readTokens();
  redirect(access || refresh ? "/dashboard" : "/login");
}
