/**
 * `/notes/[noteId]` — view and edit one note.
 *
 * A 404 from the backend covers both "deleted elsewhere" and "not yours" —
 * the API answers identically on purpose (error-contract.md §6), and the UI
 * treats them the same: stop showing it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteNoteAction,
  setNoteArchivedAction,
  updateNoteAction,
} from "@/app/(protected)/notes/actions";
import { ArchiveToggleButton, DeleteNoteButton } from "@/components/notes/note-actions";
import { NoteForm } from "@/components/notes/note-form";
import { getNote } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { readTokens, withRenderAuth } from "@/lib/auth/session";
import { formatTimestamp } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ noteId: string }>;
}): Promise<Metadata> {
  const { noteId } = await params;
  // Best-effort title: metadata generation must never bounce through the
  // refresh handler (no redirect from here) — the page itself enforces the
  // session and renders the real content.
  const { access } = await readTokens();
  if (access) {
    try {
      const note = await getNote(noteId, access);
      return { title: note.title };
    } catch {
      // fall through to the generic title
    }
  }
  return { title: "Note" };
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;

  let note;
  try {
    note = await withRenderAuth(`/notes/${noteId}`, (token) => getNote(noteId, token));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{note.title}</h1>
        <Link className="btn btn-secondary" href="/notes">
          ← Back to notes
        </Link>
      </div>

      <p className="note-meta" style={{ marginTop: 0 }}>
        Created {formatTimestamp(note.created_at)} · Updated{" "}
        {formatTimestamp(note.updated_at)}
        {note.is_archived ? " · " : ""}
        {note.is_archived ? <span className="badge">Archived</span> : null}
      </p>

      <NoteForm
        action={updateNoteAction.bind(null, note.id)}
        mode="edit"
        initial={{ title: note.title, content: note.content }}
      />

      <div className="note-actions" style={{ marginTop: "var(--space-5)" }}>
        <ArchiveToggleButton
          action={setNoteArchivedAction.bind(null, note.id, !note.is_archived)}
          isArchived={note.is_archived}
        />
        <DeleteNoteButton action={deleteNoteAction.bind(null, note.id)} />
      </div>
    </>
  );
}
