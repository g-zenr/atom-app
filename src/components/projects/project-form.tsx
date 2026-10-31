"use client";

import { useActionState } from "react";

import { initialProjectFormState, type ProjectFormState } from "@/lib/projects/project-form-state";

/**
 * The create/edit project form.
 *
 * `action` is a server action passed from a Server Component (for edit, the
 * project id is bound server-side). Field errors come from the backend's 422
 * FieldViolations, mapped by the action; the form never talks to the backend.
 * Name and description limits mirror the backend's published rules
 * (120 / 5 000 characters).
 */
export function ProjectForm({
  action,
  mode,
  initial,
}: {
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  mode: "create" | "edit";
  initial?: { name: string; description: string };
}) {
  const [state, formAction, pending] = useActionState(action, initialProjectFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate>
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="project-name">Name</label>
        <input
          id="project-name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={initial?.name}
          aria-invalid={fieldErrors["name"] ? true : undefined}
          aria-describedby={fieldErrors["name"] ? "project-name-error" : undefined}
          disabled={pending}
        />
        {fieldErrors["name"] ? (
          <p className="field-error" id="project-name-error">
            {fieldErrors["name"].join(" ")}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="project-description">Description</label>
        <textarea
          id="project-description"
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={initial?.description}
          aria-invalid={fieldErrors["description"] ? true : undefined}
          aria-describedby={fieldErrors["description"] ? "project-description-error" : undefined}
          disabled={pending}
        />
        {fieldErrors["description"] ? (
          <p className="field-error" id="project-description-error">
            {fieldErrors["description"].join(" ")}
          </p>
        ) : null}
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create project" : "Save changes"}
      </button>
    </form>
  );
}
