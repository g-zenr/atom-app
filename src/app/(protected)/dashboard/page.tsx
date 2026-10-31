/**
 * `/dashboard` — the workspace overview, built only from what the existing
 * list endpoints actually return.
 *
 * There is no aggregation endpoint, so the dashboard makes small first-page
 * fetches and labels every derived number as a sample:
 *
 * - recent notes / claims / applications: the first 5 of each list (all three
 *   lists are newest-first by the contract),
 * - projects: the first 8 (newest first); the top 5 are shown,
 * - tasks: the first page (5) of each sampled project's task list, from which
 *   the pending list and the done/total progress are computed — honestly
 *   labelled "of recent", never as a workspace-wide metric.
 *
 * Claims and applications are read-only here: their modules are not built yet,
 * so their cards carry no links — showing nothing would be less true than
 * showing the data without a destination.
 */

import Link from "next/link";

import { EmptyState } from "@/components/states";
import {
  listApplications,
  listClaims,
  listNotes,
  listProjects,
  listTasks,
  type TaskResponse,
} from "@/lib/api/client";
import { withRenderAuth } from "@/lib/auth/session";
import {
  DASHBOARD_PROJECT_TASK_WINDOW,
  DASHBOARD_RECENT_LIMIT,
  DASHBOARD_TASK_PAGE_SIZE,
  formatClaimTotal,
  isPendingTask,
  taskProgress,
} from "@/lib/dashboard/summary";
import { formatTimestamp } from "@/lib/format";

interface PendingTaskRow {
  project_id: string;
  project_name: string;
  task: TaskResponse;
}

export default async function DashboardPage() {
  const data = await withRenderAuth("/dashboard", async (token) => {
    // The projects fetch covers the task window (8); the projects card shows
    // the top 5 of the same page.
    const [notesPage, projectsPage, claimsPage, applicationsPage] = await Promise.all([
      listNotes({ limit: DASHBOARD_RECENT_LIMIT }, token),
      listProjects({ limit: DASHBOARD_PROJECT_TASK_WINDOW }, token),
      listClaims({ limit: DASHBOARD_RECENT_LIMIT }, token),
      listApplications({ limit: DASHBOARD_RECENT_LIMIT }, token),
    ]);

    const sampledProjects = projectsPage.items.slice(0, DASHBOARD_PROJECT_TASK_WINDOW);
    const taskPages = await Promise.all(
      sampledProjects.map((project) =>
        listTasks(project.id, { limit: DASHBOARD_TASK_PAGE_SIZE }, token),
      ),
    );
    // taskPages[i] is the task page of sampledProjects[i] — same order by construction.
    const pendingTasks: PendingTaskRow[] = sampledProjects.flatMap((project, index) =>
      (taskPages[index]?.items ?? [])
        .filter(isPendingTask)
        .map((task) => ({ project_id: project.id, project_name: project.name, task })),
    );

    return {
      notesPage,
      projectsPage,
      claimsPage,
      applicationsPage,
      sampledTasks: taskPages.flatMap((page) => page.items),
      pendingTasks,
    };
  });

  const {
    notesPage,
    projectsPage,
    claimsPage,
    applicationsPage,
    sampledTasks,
    pendingTasks,
  } = data;

  const progress = taskProgress(sampledTasks);
  const recentProjects = projectsPage.items.slice(0, DASHBOARD_RECENT_LIMIT);
  const recentNotes = notesPage.items;
  const recentClaims = claimsPage.items;
  const recentApplications = applicationsPage.items;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{notesPage.pagination.total}</span>
          <span className="stat-label">Active notes</span>
        </div>
        <div className="stat">
          <span className="stat-value">{projectsPage.pagination.total}</span>
          <span className="stat-label">Projects</span>
        </div>
        <div className="stat">
          <span className="stat-value">{progress.pending}</span>
          <span className="stat-label">Pending tasks (of recent)</span>
        </div>
        <div className="stat">
          <span className="stat-value">{claimsPage.pagination.total}</span>
          <span className="stat-label">Claims</span>
        </div>
        <div className="stat">
          <span className="stat-value">{applicationsPage.pagination.total}</span>
          <span className="stat-label">Applications</span>
        </div>
      </div>

      <div className="card-grid">
        <section className="card">
          <h2>Recent notes</h2>
          {recentNotes.length === 0 ? (
            <EmptyState
              title="No notes yet."
              action={
                <Link className="btn" href="/notes/new">
                  New note
                </Link>
              }
            />
          ) : (
            <>
              <ul className="card-list">
                {recentNotes.map((note) => (
                  <li key={note.id}>
                    <Link href={`/notes/${note.id}`}>{note.title}</Link>
                    <span className="note-meta">{formatTimestamp(note.created_at)}</span>
                  </li>
                ))}
              </ul>
              <p className="card-more">
                <Link href="/notes">All notes →</Link>
              </p>
            </>
          )}
        </section>

        <section className="card">
          <h2>Projects</h2>
          {recentProjects.length === 0 ? (
            <EmptyState
              title="No projects yet."
              action={
                <Link className="btn" href="/projects">
                  Create a project
                </Link>
              }
            />
          ) : (
            <>
              <ul className="card-list">
                {recentProjects.map((project) => (
                  <li key={project.id}>
                    <Link href={`/projects/${project.id}`}>{project.name}</Link>
                    <span className="note-meta">{formatTimestamp(project.created_at)}</span>
                  </li>
                ))}
              </ul>
              <p className="card-more">
                <Link href="/projects">All projects →</Link>
              </p>
            </>
          )}
        </section>

        <section className="card">
          <h2>Tasks</h2>
          <div
            className="progress"
            role="progressbar"
            aria-label="Task progress over the sampled tasks"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent ?? undefined}
          >
            <div className="progress-fill" style={{ width: `${progress.percent ?? 0}%` }} />
          </div>
          <p className="progress-label">
            {progress.done} of {progress.total} done
            {progress.percent !== null ? ` (${progress.percent}%)` : ""} — of the first{" "}
            {DASHBOARD_TASK_PAGE_SIZE} tasks in the newest projects, not the whole workspace.
          </p>
          {pendingTasks.length === 0 ? (
            <EmptyState title="No pending tasks in the sampled projects." />
          ) : (
            <ul className="card-list">
              {pendingTasks.map((row) => (
                <li key={row.task.id}>
                  <Link href={`/projects/${row.project_id}`}>{row.task.title}</Link>
                  <span className="note-meta">{row.project_name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Recent claims</h2>
          {recentClaims.length === 0 ? (
            <EmptyState title="No expense claims yet." />
          ) : (
            <ul className="card-list">
              {recentClaims.map((claim) => (
                <li key={claim.id}>
                  <span>{claim.title}</span>
                  <span className="note-meta">
                    <span className="badge">{claim.status}</span>{" "}
                    {formatClaimTotal(claim)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="card-more">Read-only here — the reimbursements module is not built yet.</p>
        </section>

        <section className="card">
          <h2>Recent applications</h2>
          {recentApplications.length === 0 ? (
            <EmptyState title="No job applications yet." />
          ) : (
            <ul className="card-list">
              {recentApplications.map((application) => (
                <li key={application.id}>
                  <span>{application.role_title}</span>
                  <span className="note-meta">
                    <span className="badge">{application.status}</span>{" "}
                    {application.applied_on ?? "not applied yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="card-more">Read-only here — the job-applications module is not built yet.</p>
        </section>
      </div>
    </>
  );
}
