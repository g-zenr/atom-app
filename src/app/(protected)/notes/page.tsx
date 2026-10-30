/**
 * `GET /notes` — the paginated notes list.
 *
 * - `limit`/`offset` follow the shared pagination convention; paging uses the
 *   **applied** values from the envelope (`pagination.limit/offset`), never
 *   the requested ones.
 * - `search` is sent as typed; the 200-character rule is the backend's
 *   business rule and a violation surfaces as an error state naming `search`.
 * - `archived` is the API's tri-state: `true` shows archived notes, anything
 *   else shows active notes. There is no "both" view.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteNoteAction,
  setNoteArchivedAction,
} from "@/app/(protected)/notes/actions";
import { ArchiveToggleButton, DeleteNoteButton } from "@/components/notes/note-actions";
import { EmptyNotes } from "@/components/states";
import { listNotes } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { NOTES_PAGE_SIZE, nextPageOffset, previousPageOffset } from "@/lib/api/pagination";
import { withRenderAuth } from "@/lib/auth/session";
import { formatTimestamp, snippet } from "@/lib/format";

interface NotesSearchParams {
  search?: string;
  archived?: string;
  offset?: string;
}

/** The URL of the list under the current filters, used as the refresh bounce target. */
function notesPath(search: string, archived: boolean, offset: number): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (archived) params.set("archived", "true");
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return `/notes${qs ? `?${qs}` : ""}`;
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<NotesSearchParams>;
}) {
  const sp = await searchParams;
  const search = typeof sp.search === "string" ? sp.search : "";
  const archived = sp.archived === "true";
  // View-state coercion only: a non-numeric offset is simply the first page.
  // The backend remains the validator for anything it receives.
  const parsedOffset = Number.parseInt(sp.offset ?? "0", 10);
  const offset = Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const path = notesPath(search, archived, offset);

  let page;
  try {
    page = await withRenderAuth(path, (token) =>
      listNotes(
        {
          limit: NOTES_PAGE_SIZE,
          offset,
          ...(search ? { search } : {}),
          ...(archived ? { archived: true } : {}),
        },
        token,
      ),
    );
  } catch (error) {
    // The list route only exists with an id in the OpenAPI document as
    // `/api/v1/notes` — a 404 here would mean a contract change.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { items, pagination } = page;
  const next = nextPageOffset(pagination);
  const prev = previousPageOffset(pagination);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{archived ? "Archived notes" : "Notes"}</h1>
        <Link className="btn" href="/notes/new">
          New note
        </Link>
      </div>

      <div className="toolbar">
        <form className="search-form" method="get" action="/notes" role="search">
          {archived ? <input type="hidden" name="archived" value="true" /> : null}
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search notes…"
            aria-label="Search notes"
          />
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
        </form>
        <Link
          className="btn btn-secondary"
          href={notesPath(search, !archived, 0)}
          aria-pressed={archived}
        >
          {archived ? "Show active" : "Show archived"}
        </Link>
        {search ? (
          <Link className="btn btn-secondary" href={notesPath("", archived, 0)}>
            Clear search
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyNotes search={search} archived={archived} />
      ) : (
        <ul className="note-list">
          {items.map((note) => (
            <li key={note.id} className="note-item">
              <div className="note-item-header">
                <h2 className="note-title">
                  <Link href={`/notes/${note.id}`}>{note.title}</Link>
                </h2>
                <span className="note-meta">
                  Updated {formatTimestamp(note.updated_at)}
                </span>
              </div>
              {note.is_archived ? <span className="badge">Archived</span> : null}
              {note.content ? <p className="note-snippet">{snippet(note.content)}</p> : null}
              <div className="note-actions">
                <ArchiveToggleButton
                  action={setNoteArchivedAction.bind(null, note.id, !note.is_archived)}
                  isArchived={note.is_archived}
                />
                <Link className="btn btn-secondary btn-small" href={`/notes/${note.id}`}>
                  Edit
                </Link>
                <DeleteNoteButton action={deleteNoteAction.bind(null, note.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="pagination">
          <span>
            {prev !== null ? (
              <Link className="btn btn-secondary btn-small" href={notesPath(search, archived, prev)}>
                ← Previous
              </Link>
            ) : (
              <span />
            )}
          </span>
          <span aria-live="polite">
            {pagination.offset + 1}–{pagination.offset + items.length} of {pagination.total}
          </span>
          <span>
            {next !== null ? (
              <Link className="btn btn-secondary btn-small" href={notesPath(search, archived, next)}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </span>
        </div>
      ) : null}
    </>
  );
}
