"use client";

import { useFormStatus } from "react-dom";

/**
 * The per-task buttons on the project detail page: the done/reopen toggle and
 * the delete button.
 *
 * Client components because delete asks for confirmation. The actions are
 * server actions bound server-side (project and task ids) and passed as props —
 * these components hold no ids and no logic.
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

export function TaskStatusToggle({
  action,
  isDone,
}: {
  action: ServerAction;
  isDone: boolean;
}) {
  return (
    <form action={action} style={{ margin: 0 }}>
      <SubmitButton
        label={isDone ? "Reopen" : "Mark done"}
        pendingLabel={isDone ? "Reopening…" : "Completing…"}
        className="btn btn-secondary btn-small"
      />
    </form>
  );
}

export function DeleteTaskButton({ action }: { action: ServerAction }) {
  return (
    <form action={action} style={{ margin: 0 }}>
      <SubmitButton
        label="Delete"
        pendingLabel="Deleting…"
        className="btn btn-danger btn-small"
        confirmMessage="Delete this task?"
      />
    </form>
  );
}
