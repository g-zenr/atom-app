/**
 * The state shared by the project server actions and the project form client
 * component. Lives outside the "use server" module because a server-action
 * file may only export async functions.
 */

export interface ProjectFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialProjectFormState: ProjectFormState = { status: "idle" };
