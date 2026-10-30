/**
 * Shared loading, empty and error states. Presentational and server-safe.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-label={label} />
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <p style={{ margin: 0 }}>
        <strong>{title}</strong>
        {hint ? (
          <>
            <br />
            {hint}
          </>
        ) : null}
      </p>
      {action}
    </div>
  );
}

export function EmptyNotes({ search, archived }: { search: string; archived: boolean }) {
  if (search.length > 0) {
    return (
      <EmptyState
        title="No notes match your search."
        hint="Try a different term, or clear the search."
      />
    );
  }
  if (archived) {
    return <EmptyState title="No archived notes." />;
  }
  return (
    <EmptyState
      title="No notes yet."
      hint="Write your first note to get started."
      action={
        <Link className="btn" href="/notes/new">
          New note
        </Link>
      }
    />
  );
}
