/**
 * The state shared by the note server actions and the note form client
 * component. Lives outside the "use server" module because a server-action
 * file may only export async functions.
 */

export interface NoteFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialNoteFormState: NoteFormState = { status: "idle" };
