import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { readTokens } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Already holding a session cookie? Go straight to the app.
  const { access, refresh } = await readTokens();
  if (access || refresh) redirect("/notes");

  return (
    <main className="auth-main">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="auth-sub">Your ATOM workspace.</p>
        <LoginForm />
        <p className="auth-alt">
          No account yet? <Link href="/register">Create one</Link>.
        </p>
      </div>
    </main>
  );
}
