/**
 * Pure helpers behind the dashboard.
 *
 * The dashboard fabricates nothing: every number it shows comes from the
 * pagination envelopes and the items the first pages actually returned. These
 * helpers exist so the honest-labels rule (e.g. progress "of recent") is
 * computed in one tested place instead of inline in the page.
 *
 * Pure and client-safe: no server imports, no I/O.
 */

import type { ClaimResponse, TaskStatus } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Sampling caps — the whole dashboard works on first pages only
// ---------------------------------------------------------------------------

/** Recent notes / claims / applications shown, and the projects cap. */
export const DASHBOARD_RECENT_LIMIT = 5;
/** The number of projects whose tasks the dashboard samples. */
export const DASHBOARD_PROJECT_TASK_WINDOW = 8;
/** The first-page size of each sampled project's task list. */
export const DASHBOARD_TASK_PAGE_SIZE = 5;

// ---------------------------------------------------------------------------
// Task progress, over the sampled tasks only
// ---------------------------------------------------------------------------

/** The statuses the dashboard counts as "pending" work. */
const PENDING_STATUSES: readonly TaskStatus[] = ["open", "in_progress"];

export interface TaskLike {
  status: TaskStatus;
}

export interface TaskProgress {
  /** Every task in the sample, done or not. */
  total: number;
  /** Tasks with status `done`. */
  done: number;
  /** Tasks with status `open` or `in_progress`. */
  pending: number;
  /** `done / total` rounded to a whole percent; `null` when the sample is empty. */
  percent: number | null;
}

/**
 * Progress computed from exactly the tasks that were fetched — never from a
 * total the API did not report for this sample.
 */
export function taskProgress(tasks: readonly TaskLike[]): TaskProgress {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const pending = tasks.filter((task) => PENDING_STATUSES.includes(task.status)).length;
  return {
    total,
    done,
    pending,
    percent: total === 0 ? null : Math.round((done / total) * 100),
  };
}

/** True when a task still needs work; a `done` task is never pending. */
export function isPendingTask(task: TaskLike): boolean {
  return PENDING_STATUSES.includes(task.status);
}

// ---------------------------------------------------------------------------
// Display formatting for claim money
// ---------------------------------------------------------------------------

/**
 * The API publishes money as a four-decimal string (`"149.8000"`). For display
 * it is trimmed to two decimals; a value that does not match the published
 * shape is shown raw rather than guessed at.
 */
export function formatMoneyAmount(amount: string): string {
  if (!/^\d+(\.\d{1,4})?$/.test(amount)) return amount;
  const [whole, fraction = ""] = amount.split(".");
  const padded = (fraction + "00").slice(0, 2);
  return fraction.length === 0 ? whole : `${whole}.${padded}`;
}

/** One dashboard line for a claim: `"EUR 149.80"` from the published fields. */
export function formatClaimTotal(claim: Pick<ClaimResponse, "currency" | "total_amount">): string {
  return `${claim.currency} ${formatMoneyAmount(claim.total_amount)}`;
}
