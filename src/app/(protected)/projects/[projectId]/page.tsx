/**
 * `/projects/[projectId]` — one project: edit, delete, and its tasks.
 *
 * A 404 from the backend covers both "deleted elsewhere" and "not yours" —
 * the API answers identically on purpose (error-contract.md §6), and the UI
 * treats them the same: stop showing it.
 *
 * Tasks live only inside their project (there is no `/tasks` collection). The
 * task list is shown in the backend's manual order — `position ASC,
 * created_at ASC, id ASC` (TASK-R04) — and is never re-sorted here. Status and
 * priority filters travel in the query string as plain GET parameters.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createTaskAction,
  deleteProjectAction,
  deleteTaskAction,
  setTaskStatusAction,
  updateProjectAction,
  updateTaskAction,
} from "@/app/(protected)/projects/actions";
import { DeleteProjectButton } from "@/components/projects/project-actions";
import { ProjectForm } from "@/components/projects/project-form";
import { DeleteTaskButton, TaskStatusToggle } from "@/components/tasks/task-actions";
import { TaskForm } from "@/components/tasks/task-form";
import { EmptyState } from "@/components/states";
import {
  getProject,
  listTasks,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { TASKS_PAGE_SIZE, nextPageOffset, previousPageOffset } from "@/lib/api/pagination";
import { readTokens, withRenderAuth } from "@/lib/auth/session";
import { formatTimestamp } from "@/lib/format";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  asTaskPriority,
  asTaskStatus,
} from "@/lib/tasks/task-fields";

/** The current task filters, as carried in the URL and handed to the API. */
interface TaskFilters {
  status?: string;
  priority?: string;
  offset?: number;
}

/** The raw query string the page receives; values are coerced into TaskFilters. */
interface ProjectDetailSearchParams {
  status?: string;
  priority?: string;
  offset?: string;
}

interface ProjectDetailPathProps {
  projectId: string;
  params: TaskFilters;
}

/** The URL of the detail page under the current task filters. */
function projectDetailPath({ projectId, params }: ProjectDetailPathProps): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.priority) search.set("priority", params.priority);
  if (params.offset !== undefined && params.offset > 0) search.set("offset", String(params.offset));
  const qs = search.toString();
  return `/projects/${projectId}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  // Best-effort title: metadata generation must never bounce through the
  // refresh handler (no redirect from here) — the page itself enforces the
  // session and renders the real content.
  const { access } = await readTokens();
  if (access) {
    try {
      const project = await getProject(projectId, access);
      return { title: project.name };
    } catch {
      // fall through to the generic title
    }
  }
  return { title: "Project" };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<ProjectDetailSearchParams>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;

  // Query-param coercion only: an unknown filter value simply means "no
  // filter". The backend remains the validator for anything it receives.
  const status = asTaskStatus(sp.status ?? "");
  const priority = asTaskPriority(sp.priority ?? "");
  const parsedOffset = Number.parseInt(sp.offset ?? "0", 10);
  const offset = Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const path = projectDetailPath({ projectId, params: { status, priority, offset } });

  let project;
  try {
    project = await withRenderAuth(path, (token) => getProject(projectId, token));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // A project with no tasks answers an empty page, never a 404. A task-list
  // 404 would mean the project vanished mid-render — the same answer applies.
  let taskPage;
  try {
    taskPage = await withRenderAuth(path, (token) =>
      listTasks(
        projectId,
        {
          limit: TASKS_PAGE_SIZE,
          offset,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        },
        token,
      ),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const tasks = taskPage.items;
  const taskNext = nextPageOffset(taskPage.pagination);
  const taskPrev = previousPageOffset(taskPage.pagination);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{project.name}</h1>
        <Link className="btn btn-secondary" href="/projects">
          ← Back to projects
        </Link>
      </div>

      <p className="note-meta" style={{ marginTop: 0 }}>
        Created {formatTimestamp(project.created_at)} · Updated{" "}
        {formatTimestamp(project.updated_at)}
      </p>

      {project.description ? <p className="note-snippet">{project.description}</p> : null}

      <section style={{ marginTop: "var(--space-5)" }}>
        <h2 className="section-title">Edit project</h2>
        <ProjectForm
          action={updateProjectAction.bind(null, project.id)}
          mode="edit"
          initial={{ name: project.name, description: project.description }}
        />
        <div className="note-actions" style={{ marginTop: "var(--space-4)" }}>
          <DeleteProjectButton action={deleteProjectAction.bind(null, project.id)} />
        </div>
      </section>

      <section style={{ marginTop: "var(--space-6)" }}>
        <h2 className="section-title">Tasks</h2>

        <div className="toolbar">
          <form className="filter-form" method="get" action={`/projects/${projectId}`}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="task-filter-status">Status</label>
              <select id="task-filter-status" name="status" defaultValue={status ?? ""}>
                <option value="">All</option>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="task-filter-priority">Priority</label>
              <select id="task-filter-priority" name="priority" defaultValue={priority ?? ""}>
                <option value="">All</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-secondary" type="submit">
              Filter
            </button>
          </form>
          {status || priority ? (
            <Link className="btn btn-secondary" href={`/projects/${projectId}`}>
              Clear filters
            </Link>
          ) : null}
        </div>

        <details className="create-panel" style={{ marginBottom: "var(--space-4)" }}>
          <summary>New task</summary>
          <div className="create-panel-body">
            <TaskForm action={createTaskAction.bind(null, projectId)} mode="create" />
          </div>
        </details>

        {tasks.length === 0 ? (
          <EmptyState
            title={status || priority ? "No tasks match these filters." : "No tasks yet."}
            hint={
              status || priority
                ? "Try different filters, or clear them."
                : "Add the first task for this project above."
            }
          />
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li key={task.id} className={task.status === "done" ? "task-item done" : "task-item"}>
                <div className="note-item-header">
                  <h3 className="task-title">{task.title}</h3>
                  <span className="note-meta">
                    <span className="badge">{TASK_STATUS_LABELS[task.status]}</span>{" "}
                    <span className="badge">{TASK_PRIORITY_LABELS[task.priority]}</span>
                  </span>
                </div>
                {task.description ? <p className="note-snippet">{task.description}</p> : null}
                <div className="note-actions">
                  <TaskStatusToggle
                    action={setTaskStatusAction.bind(
                      null,
                      projectId,
                      task.id,
                      task.status === "done" ? "open" : "done",
                    )}
                    isDone={task.status === "done"}
                  />
                  <details className="task-edit">
                    <summary className="btn btn-secondary btn-small">Edit</summary>
                    <div className="create-panel-body">
                      <TaskForm
                        action={updateTaskAction.bind(null, projectId, task.id)}
                        mode="edit"
                        initial={{
                          title: task.title,
                          description: task.description,
                          status: task.status,
                          priority: task.priority,
                        }}
                      />
                    </div>
                  </details>
                  <DeleteTaskButton action={deleteTaskAction.bind(null, projectId, task.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {tasks.length > 0 ? (
          <div className="pagination">
            <span>
              {taskPrev !== null ? (
                <Link
                  className="btn btn-secondary btn-small"
                  href={projectDetailPath({ projectId, params: { status, priority, offset: taskPrev } })}
                >
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
            </span>
            <span aria-live="polite">
              {taskPage.pagination.offset + 1}–{taskPage.pagination.offset + tasks.length} of{" "}
              {taskPage.pagination.total}
            </span>
            <span>
              {taskNext !== null ? (
                <Link
                  className="btn btn-secondary btn-small"
                  href={projectDetailPath({ projectId, params: { status, priority, offset: taskNext } })}
                >
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </span>
          </div>
        ) : null}
      </section>
    </>
  );
}
