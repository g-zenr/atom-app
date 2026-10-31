"use client";

import { useFormStatus } from "react-dom";

/**
 * The destructive button on a project page.
 *
 * Client component because delete asks for confirmation — a project delete
 * cascades to every task inside it, so the message says so. The action itself
 * is a server action bound server-side and passed as a prop.
 */

type ServerAction = () => Promise<void>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-danger btn-small"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm("Delete this project and all of its tasks?")) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Deleting…" : "Delete project"}
    </button>
  );
}

export function DeleteProjectButton({ action }: { action: ServerAction }) {
  return (
    <form action={action} style={{ margin: 0 }}>
      <SubmitButton />
    </form>
  );
}
