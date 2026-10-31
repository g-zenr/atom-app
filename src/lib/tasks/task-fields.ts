/**
 * The lifecycle states and priorities of a task, with the value guards and
 * display labels the forms and lists share.
 *
 * Pure and client-safe: no server imports, so both the server actions and the
 * form component can use it, and the guards are unit-testable.
 */

import type { TaskPriority, TaskStatus } from "@/lib/api/client";

export const TASK_STATUSES = ["open", "in_progress", "done"] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Narrows untrusted form input to a `TaskStatus`; anything else is absent. */
export function asTaskStatus(value: string): TaskStatus | undefined {
  return (TASK_STATUSES as readonly string[]).includes(value)
    ? (value as TaskStatus)
    : undefined;
}

/** Narrows untrusted form input to a `TaskPriority`; anything else is absent. */
export function asTaskPriority(value: string): TaskPriority | undefined {
  return (TASK_PRIORITIES as readonly string[]).includes(value)
    ? (value as TaskPriority)
    : undefined;
}
