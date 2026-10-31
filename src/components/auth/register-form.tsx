"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { submitAuthForm } from "@/lib/client/auth-forms";

/**
 * The registration form. Field-level errors come straight from the backend's
 * 422 FieldViolations — the password policy reports every unmet rule at once,
 * so a field can carry several messages.
 */
export function RegisterForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
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

    const result = await submitAuthForm("/api/auth/register", {
      email,
      password,
      display_name: displayName,
    });
    if (result.ok) {
      // Registration signs the user in: the handler stored the pair.
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
    // A body that parses but does not match the contract names the field
    // `body`; a 409 (email taken) has no details. Both land here.
    setFormError(
      grouped["body"]?.join(" ") ?? result.error?.message ?? "Registration failed.",
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="register-display-name">Display name</label>
        <input
          id="register-display-name"
          name="display_name"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          aria-invalid={fieldMessages["display_name"] ? true : undefined}
          aria-describedby={fieldMessages["display_name"] ? "register-display-name-error" : undefined}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={pending}
        />
        {fieldMessages["display_name"] ? (
          <p className="field-error" id="register-display-name-error">
            {fieldMessages["display_name"].join(" ")}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          aria-invalid={fieldMessages["email"] ? true : undefined}
          aria-describedby={fieldMessages["email"] ? "register-email-error" : undefined}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
        {fieldMessages["email"] ? (
          <p className="field-error" id="register-email-error">
            {fieldMessages["email"].join(" ")}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          aria-invalid={fieldMessages["password"] ? true : undefined}
          aria-describedby={
            fieldMessages["password"] ? "register-password-error register-password-hint" : "register-password-hint"
          }
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
        <p className="field-error" id="register-password-hint" style={{ color: "var(--color-text-muted)" }}>
          At least 12 characters, with upper case, lower case and a digit.
        </p>
        {fieldMessages["password"] ? (
          <p className="field-error" id="register-password-error">
            {fieldMessages["password"].join(" ")}
          </p>
        ) : null}
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
