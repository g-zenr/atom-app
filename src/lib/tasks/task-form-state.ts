/**
 * The state shared by the task server actions and the task form client
 * component. Lives outside the "use server" module because a server-action
 * file may only export async functions.
 */

export interface TaskFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialTaskFormState: TaskFormState = { status: "idle" };
