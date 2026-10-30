"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Signs out through the BFF (`POST /api/auth/logout`), which revokes the
 * backend session and clears the HttpOnly cookies, then leaves the app.
 */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even without an answer, the next request carries no session.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="btn btn-secondary btn-small"
      onClick={handleLogout}
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
