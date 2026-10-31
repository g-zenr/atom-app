import { describe, expect, it } from "vitest";

import type { components } from "../src/lib/api/schema";
import {
  DASHBOARD_PROJECT_TASK_WINDOW,
  DASHBOARD_RECENT_LIMIT,
  DASHBOARD_TASK_PAGE_SIZE,
  formatClaimTotal,
  formatMoneyAmount,
  isPendingTask,
  taskProgress,
} from "../src/lib/dashboard/summary";

type TaskStatus = components["schemas"]["TaskStatus"];

function task(status: TaskStatus): { status: TaskStatus } {
  return { status };
}

describe("taskProgress", () => {
  it("reports an empty sample as null percent, never a fabricated 0 or 100", () => {
    expect(taskProgress([])).toEqual({ total: 0, done: 0, pending: 0, percent: null });
  });

  it("counts done and pending over exactly the tasks that were fetched", () => {
    const progress = taskProgress([
      task("done"),
      task("done"),
      task("open"),
      task("in_progress"),
    ]);
    expect(progress).toEqual({ total: 4, done: 2, pending: 2, percent: 50 });
  });

  it("rounds to a whole percent", () => {
    // 1 of 3 = 33.33…% → 33
    expect(taskProgress([task("done"), task("open"), task("open")]).percent).toBe(33);
    // 2 of 3 = 66.66…% → 67
    expect(taskProgress([task("done"), task("done"), task("open")]).percent).toBe(67);
  });

  it("reaches 0 and 100 at the extremes", () => {
    expect(taskProgress([task("open"), task("in_progress")]).percent).toBe(0);
    expect(taskProgress([task("done"), task("done")]).percent).toBe(100);
  });
});

describe("isPendingTask", () => {
  it("treats open and in_progress as pending and done as not pending", () => {
    expect(isPendingTask(task("open"))).toBe(true);
    expect(isPendingTask(task("in_progress"))).toBe(true);
    expect(isPendingTask(task("done"))).toBe(false);
  });
});

describe("formatMoneyAmount", () => {
  it("trims the published four-decimal string to two decimals", () => {
    expect(formatMoneyAmount("149.8000")).toBe("149.80");
    expect(formatMoneyAmount("0.0000")).toBe("0.00");
    expect(formatMoneyAmount("12.3400")).toBe("12.34");
  });

  it("pads a short fraction and keeps whole numbers whole", () => {
    expect(formatMoneyAmount("12.3")).toBe("12.30");
    expect(formatMoneyAmount("12")).toBe("12");
  });

  it("shows an out-of-contract value raw rather than guessing", () => {
    expect(formatMoneyAmount("-5.0000")).toBe("-5.0000");
    expect(formatMoneyAmount("1,49.80")).toBe("1,49.80");
    expect(formatMoneyAmount("")).toBe("");
  });
});

describe("formatClaimTotal", () => {
  it("prefixes the ISO 4217 currency", () => {
    expect(formatClaimTotal({ currency: "EUR", total_amount: "149.8000" })).toBe("EUR 149.80");
  });
});

describe("dashboard sampling caps", () => {
  it("stay small and ordered like the brief: 5 recent, 8 projects, page size 5", () => {
    expect(DASHBOARD_RECENT_LIMIT).toBe(5);
    expect(DASHBOARD_PROJECT_TASK_WINDOW).toBe(8);
    expect(DASHBOARD_TASK_PAGE_SIZE).toBe(5);
  });
});
