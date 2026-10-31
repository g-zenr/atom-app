/**
 * The protected shell.
 *
 * Guard: a visitor with neither session cookie is sent to /login. Presence is
 * the only check here — validity is enforced per backend call (the access
 * token is short-lived by design, and `withRenderAuth` handles renewal).
 *
 * The user chip is best-effort (`loadShellUser`): the layout renders on every
 * request and cannot write cookies, so a failed `/auth/me` degrades to "no
 * chip" instead of bouncing the user. Page-level data calls enforce the
 * session for real.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { Nav } from "@/components/nav";
import { loadShellUser, readTokens } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { access, refresh } = await readTokens();
  if (!access && !refresh) redirect("/login");

  const user = await loadShellUser();

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link href="/dashboard" className="brand">
            ATOM
          </Link>
          <Nav />
          <div className="shell-user">
            {user ? <span>{user.display_name}</span> : null}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
