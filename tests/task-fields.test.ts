import { describe, expect, it } from "vitest";

import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  asTaskPriority,
  asTaskStatus,
} from "../src/lib/tasks/task-fields";

describe("asTaskStatus", () => {
  it("accepts exactly the contract's three statuses", () => {
    expect(asTaskStatus("open")).toBe("open");
    expect(asTaskStatus("in_progress")).toBe("in_progress");
    expect(asTaskStatus("done")).toBe("done");
  });

  it("narrows anything else to undefined so the field is omitted, not sent", () => {
    expect(asTaskStatus("")).toBeUndefined();
    expect(asTaskStatus("DONE")).toBeUndefined();
    expect(asTaskStatus("closed")).toBeUndefined();
    expect(asTaskStatus("null")).toBeUndefined();
  });
});

describe("asTaskPriority", () => {
  it("accepts exactly the contract's four priorities", () => {
    expect(asTaskPriority("low")).toBe("low");
    expect(asTaskPriority("medium")).toBe("medium");
    expect(asTaskPriority("high")).toBe("high");
    expect(asTaskPriority("urgent")).toBe("urgent");
  });

  it("narrows anything else to undefined so the field is omitted, not sent", () => {
    expect(asTaskPriority("")).toBeUndefined();
    expect(asTaskPriority("HIGH")).toBeUndefined();
    expect(asTaskPriority("critical")).toBeUndefined();
  });
});

describe("the label maps", () => {
  it("cover every status and priority value without gaps", () => {
    expect(TASK_STATUSES).toHaveLength(TASK_STATUS_LABELS && Object.keys(TASK_STATUS_LABELS).length);
    expect(TASK_PRIORITIES).toHaveLength(
      TASK_PRIORITY_LABELS && Object.keys(TASK_PRIORITY_LABELS).length,
    );
  });

  it("label the values a person would expect", () => {
    expect(TASK_STATUS_LABELS["in_progress"]).toBe("In progress");
    expect(TASK_PRIORITY_LABELS["urgent"]).toBe("Urgent");
  });
});
