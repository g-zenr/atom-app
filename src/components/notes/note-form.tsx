"use client";

import { useActionState } from "react";

import { initialNoteFormState, type NoteFormState } from "@/lib/notes/note-form-state";

/**
 * The create/edit note form.
 *
 * `action` is a server action passed from a Server Component (for edit, the
 * note id is bound server-side). Field errors come from the backend's 422
 * FieldViolations, mapped by the action; the form never talks to the backend.
 */
export function NoteForm({
  action,
  mode,
  initial,
}: {
  action: (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;
  mode: "create" | "edit";
  initial?: { title: string; content: string };
}) {
  const [state, formAction, pending] = useActionState(action, initialNoteFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate>
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="note-title">Title</label>
        <input
          id="note-title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={initial?.title}
          aria-invalid={fieldErrors["title"] ? true : undefined}
          aria-describedby={fieldErrors["title"] ? "note-title-error" : undefined}
          disabled={pending}
        />
        {fieldErrors["title"] ? (
          <p className="field-error" id="note-title-error">
            {fieldErrors["title"].join(" ")}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="note-content">Content</label>
        <textarea
          id="note-content"
          name="content"
          rows={10}
          defaultValue={initial?.content}
          aria-invalid={fieldErrors["content"] ? true : undefined}
          aria-describedby={fieldErrors["content"] ? "note-content-error" : undefined}
          disabled={pending}
        />
        {fieldErrors["content"] ? (
          <p className="field-error" id="note-content-error">
            {fieldErrors["content"].join(" ")}
          </p>
        ) : null}
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create note" : "Save changes"}
      </button>
    </form>
  );
}
