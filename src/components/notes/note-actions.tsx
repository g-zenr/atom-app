"use client";

import { useFormStatus } from "react-dom";

/**
 * The destructive/secondary buttons on a note row or page.
 *
 * Client component because delete asks for confirmation. The actions themselves
 * are server actions bound server-side and passed as props — this component
 * holds no ids and no logic.
 */

type ServerAction = () => Promise<void>;

function SubmitButton({
  label,
  pendingLabel,
  className,
  confirmMessage,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function DeleteNoteButton({ action }: { action: ServerAction }) {
  return (
    <form action={action} className="note-actions" style={{ margin: 0 }}>
      <SubmitButton
        label="Delete"
        pendingLabel="Deleting…"
        className="btn btn-danger btn-small"
        confirmMessage="Delete this note permanently?"
      />
    </form>
  );
}

export function ArchiveToggleButton({
  action,
  isArchived,
}: {
  action: ServerAction;
  isArchived: boolean;
}) {
  return (
    <form action={action} style={{ margin: 0 }}>
      <SubmitButton
        label={isArchived ? "Unarchive" : "Archive"}
        pendingLabel={isArchived ? "Unarchiving…" : "Archiving…"}
        className="btn btn-secondary btn-small"
      />
    </form>
  );
}
