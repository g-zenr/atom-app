"use client";

import { useActionState } from "react";

import { initialTaskFormState, type TaskFormState } from "@/lib/tasks/task-form-state";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/task-fields";

/**
 * The create/edit task form.
 *
 * `action` is a server action passed from a Server Component (create is bound
 * to the project id, edit to the project and task ids). Field errors come from
 * the backend's 422 FieldViolations, mapped by the action. Title and
 * description limits mirror the backend's published rules (200 / 10 000
 * characters). The selects always carry a valid value; the action omits an
 * unrecognised one rather than sending it.
 */
export function TaskForm({
  action,
  mode,
  initial,
}: {
  action: (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  mode: "create" | "edit";
  initial?: {
    title: string;
    description: string;
    status: string;
    priority: string;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialTaskFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate>
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={initial?.title}
          aria-invalid={fieldErrors["title"] ? true : undefined}
          aria-describedby={fieldErrors["title"] ? "task-title-error" : undefined}
          disabled={pending}
        />
        {fieldErrors["title"] ? (
          <p className="field-error" id="task-title-error">
            {fieldErrors["title"].join(" ")}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          name="description"
          rows={3}
          maxLength={10000}
          defaultValue={initial?.description}
          aria-invalid={fieldErrors["description"] ? true : undefined}
          aria-describedby={fieldErrors["description"] ? "task-description-error" : undefined}
          disabled={pending}
        />
        {fieldErrors["description"] ? (
          <p className="field-error" id="task-description-error">
            {fieldErrors["description"].join(" ")}
          </p>
        ) : null}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="task-status">Status</label>
          <select
            id="task-status"
            name="status"
            defaultValue={initial?.status ?? "open"}
            disabled={pending}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="task-priority">Priority</label>
          <select
            id="task-priority"
            name="priority"
            defaultValue={initial?.priority ?? "medium"}
            disabled={pending}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Add task" : "Save changes"}
      </button>
    </form>
  );
}
