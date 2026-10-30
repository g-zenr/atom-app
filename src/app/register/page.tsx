import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { readTokens } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const { access, refresh } = await readTokens();
  if (access || refresh) redirect("/notes");

  return (
    <main className="auth-main">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="auth-sub">One account, one workspace.</p>
        <RegisterForm />
        <p className="auth-alt">
          Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </div>
    </main>
  );
}
