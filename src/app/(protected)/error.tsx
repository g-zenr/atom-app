"use client";

/**
 * Error boundary for the authenticated area.
 *
 * Session expiry never lands here (it redirects); this is for backend outages
 * and unexpected failures. The error message is shown as-is — the API's
 * internal errors are already redacted by design.
 */

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="state" role="alert">
      <p style={{ margin: 0 }}>
        <strong>Something went wrong.</strong>
        <br />
        {error.message || "An unexpected error occurred."}
      </p>
      <button className="btn" type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
