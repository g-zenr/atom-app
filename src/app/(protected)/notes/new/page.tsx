import type { Metadata } from "next";
import Link from "next/link";

import { createNoteAction } from "@/app/(protected)/notes/actions";
import { NoteForm } from "@/components/notes/note-form";

export const metadata: Metadata = { title: "New note" };

export default function NewNotePage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">New note</h1>
        <Link className="btn btn-secondary" href="/notes">
          ← Back to notes
        </Link>
      </div>
      <NoteForm action={createNoteAction} mode="create" />
    </>
  );
}
