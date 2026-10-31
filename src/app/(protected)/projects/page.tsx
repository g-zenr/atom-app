/**
 * `GET /projects` — the paginated projects list, with search and creation.
 *
 * The list is newest first (`created_at DESC, id DESC` — the backend's order).
 * `search` is sent as typed; the 200-character rule is the backend's business
 * rule and a violation surfaces as an error state naming `search`. Creation
 * lives on this page and redirects to the new project's detail page.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { createProjectAction } from "@/app/(protected)/projects/actions";
import { ProjectForm } from "@/components/projects/project-form";
import { EmptyState } from "@/components/states";
import { listProjects } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { PROJECTS_PAGE_SIZE, nextPageOffset, previousPageOffset } from "@/lib/api/pagination";
import { withRenderAuth } from "@/lib/auth/session";
import { formatTimestamp } from "@/lib/format";

interface ProjectsSearchParams {
  search?: string;
  offset?: string;
}

/** The URL of the list under the current filters, used as the refresh bounce target. */
function projectsPath(search: string, offset: number): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return `/projects${qs ? `?${qs}` : ""}`;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<ProjectsSearchParams>;
}) {
  const sp = await searchParams;
  const search = typeof sp.search === "string" ? sp.search : "";
  // View-state coercion only: a non-numeric offset is simply the first page.
  // The backend remains the validator for anything it receives.
  const parsedOffset = Number.parseInt(sp.offset ?? "0", 10);
  const offset = Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const path = projectsPath(search, offset);

  let page;
  try {
    page = await withRenderAuth(path, (token) =>
      listProjects(
        {
          limit: PROJECTS_PAGE_SIZE,
          offset,
          ...(search ? { search } : {}),
        },
        token,
      ),
    );
  } catch (error) {
    // A 404 here would mean a contract change — the list route always exists.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { items, pagination } = page;
  const next = nextPageOffset(pagination);
  const prev = previousPageOffset(pagination);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
      </div>

      <div className="toolbar">
        <form className="search-form" method="get" action="/projects" role="search">
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search projects…"
            aria-label="Search projects"
          />
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
        </form>
        {search ? (
          <Link className="btn btn-secondary" href="/projects">
            Clear search
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={search ? "No projects match your search." : "No projects yet."}
          hint={search ? "Try a different term, or clear the search." : "Create your first project below."}
        />
      ) : (
        <ul className="note-list">
          {items.map((project) => (
            <li key={project.id} className="note-item">
              <div className="note-item-header">
                <h2 className="note-title">
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                </h2>
                <span className="note-meta">
                  Created {formatTimestamp(project.created_at)}
                </span>
              </div>
              {project.description ? (
                <p className="note-snippet">{project.description}</p>
              ) : null}
              <div className="note-actions">
                <Link className="btn btn-secondary btn-small" href={`/projects/${project.id}`}>
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="pagination">
          <span>
            {prev !== null ? (
              <Link className="btn btn-secondary btn-small" href={projectsPath(search, prev)}>
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
              <Link className="btn btn-secondary btn-small" href={projectsPath(search, next)}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </span>
        </div>
      ) : null}

      <details className="create-panel" style={{ marginTop: "var(--space-5)" }}>
        <summary>New project</summary>
        <div className="create-panel-body">
          <ProjectForm action={createProjectAction} mode="create" />
        </div>
      </details>
    </>
  );
}
