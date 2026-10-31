"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { submitAuthForm } from "@/lib/client/auth-forms";

/**
 * The sign-in form. Talks only to this app's BFF (`/api/auth/login`); tokens
 * are set as HttpOnly cookies by the route handler and are never visible here.
 *
 * Field-level errors come from the backend's 422 FieldViolations; the `body`
 * pseudo-field and any message-less failure degrade to a form-level message.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldMessages, setFieldMessages] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldMessages({});

    const result = await submitAuthForm("/api/auth/login", { email, password });
    if (result.ok) {
      // The cookie is already set; a full refresh picks the session up.
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setPending(false);
    const details = result.error?.details ?? [];
    const grouped: Record<string, string[]> = {};
    for (const violation of details) {
      (grouped[violation.field] ??= []).push(violation.message);
    }
    setFieldMessages(grouped);
    // Anything that is not a named field becomes the form-level message.
    setFormError(grouped["body"]?.join(" ") ?? result.error?.message ?? "Sign-in failed.");
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          aria-invalid={fieldMessages["email"] ? true : undefined}
          aria-describedby={fieldMessages["email"] ? "login-email-error" : undefined}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
        {fieldMessages["email"] ? (
          <p className="field-error" id="login-email-error">
            {fieldMessages["email"].join(" ")}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          aria-invalid={fieldMessages["password"] ? true : undefined}
          aria-describedby={fieldMessages["password"] ? "login-password-error" : undefined}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
        {fieldMessages["password"] ? (
          <p className="field-error" id="login-password-error">
            {fieldMessages["password"].join(" ")}
          </p>
        ) : null}
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
