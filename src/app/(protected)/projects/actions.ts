"use server";

/**
 * Server Actions for projects and the tasks nested inside them.
 *
 * The same contract as the notes actions: every action authenticates through
 * `withAuth` (rotation + one retry on a 401 are handled there), a dead session
 * redirects to /login, and a 422 from the API is mapped to field-level state
 * for the form. The backend owns every business rule.
 *
 * PATCH partial semantics: an edit form always carries its fields as present
 * values; nothing is ever sent as `null`, so an untouched value is only ever
 * overwritten by what the form actually shows. An empty description is the
 * contract's legitimate way of clearing it.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  updateProject,
  updateTask,
  type TaskStatus,
} from "@/lib/api/client";
import { ApiError, type FieldViolation } from "@/lib/api/errors";
import { SessionExpiredError, withAuth } from "@/lib/auth/session";
import type { ProjectFormState } from "@/lib/projects/project-form-state";
import { asTaskPriority, asTaskStatus } from "@/lib/tasks/task-fields";
import type { TaskFormState } from "@/lib/tasks/task-form-state";

function groupViolations(details: FieldViolation[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const violation of details) {
    (grouped[violation.field] ??= []).push(violation.message);
  }
  return grouped;
}

function toFormFieldState(error: ApiError): ProjectFormState & TaskFormState {
  const grouped = groupViolations(error.details);
  return {
    status: "error",
    fieldErrors: grouped,
    // `body` is the API's name for "the JSON parsed but the object does not
    // match the contract" (error-contract.md §3) — show it at form level.
    message: grouped["body"]?.join(" ") ?? error.message,
  };
}

function redirectIfSessionDead(error: unknown): void {
  if (error instanceof SessionExpiredError) redirect("/login");
  if (error instanceof ApiError && error.isUnauthorized) redirect("/login");
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");

  let createdId: string;
  try {
    const project = await withAuth((token) => createProject({ name, description }, token));
    createdId = project.id;
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError) return toFormFieldState(error);
    throw error;
  }

  revalidatePath("/projects");
  redirect(`/projects/${createdId}`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");

  try {
    await withAuth((token) => updateProject(projectId, { name, description }, token));
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError && error.status === 404) {
      // Deleted elsewhere, or not ours: same answer either way — back to the list.
      revalidatePath("/projects");
      redirect("/projects");
    }
    if (error instanceof ApiError) return toFormFieldState(error);
    throw error;
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { status: "idle" }; // the page re-renders with fresh data; no redirect needed
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  try {
    await withAuth((token) => deleteProject(projectId, token));
  } catch (error) {
    redirectIfSessionDead(error);
    // A 404 means "already gone, or never ours" — the outcome we want is
    // identical: the project is absent. Everything else hits the boundary.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
  revalidatePath("/projects");
  redirect("/projects");
}

// ---------------------------------------------------------------------------
// Tasks (nested in a project)
// ---------------------------------------------------------------------------

export async function createTaskAction(
  projectId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  // An unrecognised select value is omitted rather than sent — the backend
  // stays the validator, and an absent field takes the backend's default.
  const status = asTaskStatus(String(formData.get("status") ?? ""));
  const priority = asTaskPriority(String(formData.get("priority") ?? ""));

  try {
    await withAuth((token) =>
      createTask(
        projectId,
        {
          title,
          description,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        },
        token,
      ),
    );
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError) return toFormFieldState(error);
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
  return { status: "idle" };
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const status = asTaskStatus(String(formData.get("status") ?? ""));
  const priority = asTaskPriority(String(formData.get("priority") ?? ""));

  // The edit form always carries title and description as present values.
  // Status and priority are sent only when the form named a valid value.
  try {
    await withAuth((token) =>
      updateTask(
        taskId,
        {
          title,
          description,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        },
        token,
      ),
    );
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError && error.status === 404) {
      // Deleted elsewhere, or not ours: stop showing it either way.
      revalidatePath(`/projects/${projectId}`);
      redirect(`/projects/${projectId}`);
    }
    if (error instanceof ApiError) return toFormFieldState(error);
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
  return { status: "idle" };
}

/** Marks a task done or reopens it; the backend stamps/clears `completed_at`. */
export async function setTaskStatusAction(
  projectId: string,
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  try {
    await withAuth((token) => updateTask(taskId, { status }, token));
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError && error.status === 404) {
      revalidatePath(`/projects/${projectId}`);
      redirect(`/projects/${projectId}`);
    }
    throw error;
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTaskAction(projectId: string, taskId: string): Promise<void> {
  try {
    await withAuth((token) => deleteTask(taskId, token));
  } catch (error) {
    redirectIfSessionDead(error);
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
  revalidatePath(`/projects/${projectId}`);
}
