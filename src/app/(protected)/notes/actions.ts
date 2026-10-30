"use server";

/**
 * Server Actions for notes.
 *
 * Every action authenticates through `withAuth`, which may rotate the token
 * pair (these are persistent contexts, so cookie writes are allowed) and
 * retries once on a 401. A dead session redirects to /login — `redirect()`
 * inside a catch block is safe here because nothing afterwards catches
 * NEXT_REDIRECT.
 *
 * The backend owns every business rule. These actions validate nothing except
 * reading the form fields; a 422 from the API is mapped to field-level state
 * for the form, and `field: "body"` (a body that parsed but did not match the
 * contract) degrades to a form-level message.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createNote, deleteNote, updateNote } from "@/lib/api/client";
import { ApiError, type FieldViolation } from "@/lib/api/errors";
import { SessionExpiredError, withAuth } from "@/lib/auth/session";
import type { NoteFormState } from "@/lib/notes/note-form-state";

function groupViolations(details: FieldViolation[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const violation of details) {
    (grouped[violation.field] ??= []).push(violation.message);
  }
  return grouped;
}

function toFormFieldState(error: ApiError): NoteFormState {
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

export async function createNoteAction(
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const title = String(formData.get("title") ?? "");
  const content = String(formData.get("content") ?? "");

  let createdId: string;
  try {
    const note = await withAuth((token) => createNote({ title, content }, token));
    createdId = note.id;
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError) return toFormFieldState(error);
    throw error;
  }

  revalidatePath("/notes");
  redirect(`/notes/${createdId}`);
}

export async function updateNoteAction(
  noteId: string,
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const title = String(formData.get("title") ?? "");
  const content = String(formData.get("content") ?? "");

  // PATCH is partial: the edit form always carries both fields, and both are
  // sent as present values. Content may legitimately be set to "" (the
  // contract's way of clearing it); nothing is ever sent as null.
  try {
    await withAuth((token) => updateNote(noteId, { title, content }, token));
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError && error.status === 404) {
      // Deleted elsewhere, or not ours: same answer either way — stop showing it.
      revalidatePath("/notes");
      redirect("/notes");
    }
    if (error instanceof ApiError) return toFormFieldState(error);
    throw error;
  }

  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
  return { status: "idle" }; // the page re-renders with fresh data; no redirect needed
}

/** Archive or unarchive. `is_archived` is the only field this action touches. */
export async function setNoteArchivedAction(
  noteId: string,
  isArchived: boolean,
): Promise<void> {
  try {
    await withAuth((token) => updateNote(noteId, { is_archived: isArchived }, token));
  } catch (error) {
    redirectIfSessionDead(error);
    if (error instanceof ApiError && error.status === 404) {
      revalidatePath("/notes");
      redirect("/notes");
    }
    throw error;
  }
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
}

export async function deleteNoteAction(noteId: string): Promise<void> {
  try {
    await withAuth((token) => deleteNote(noteId, token));
  } catch (error) {
    redirectIfSessionDead(error);
    // A 404 means "already gone, or never ours" — the API answers both the
    // same way, and the outcome we want is identical: the note is absent.
    // Every other failure propagates to the error boundary.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
  revalidatePath("/notes");
  redirect("/notes");
}
