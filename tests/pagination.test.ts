import { describe, expect, it } from "vitest";

import {
  NOTES_PAGE_SIZE,
  buildQuery,
  nextPageOffset,
  previousPageOffset,
  type PaginationMeta,
} from "../src/lib/api/pagination";

function page(offset: number, limit: number, total: number): PaginationMeta {
  return { offset, limit, total, has_more: offset + limit < total };
}

describe("nextPageOffset", () => {
  it("pages by the APPLIED limit and offset, mirroring has_more = offset + limit < total", () => {
    expect(nextPageOffset(page(0, 20, 42))).toBe(20);
    expect(nextPageOffset(page(20, 20, 42))).toBe(40);
  });

  it("returns null on the last page", () => {
    expect(nextPageOffset(page(40, 20, 42))).toBeNull();
    expect(nextPageOffset(page(0, 20, 20))).toBeNull();
    expect(nextPageOffset(page(0, 20, 0))).toBeNull();
  });

  it("uses the clamped values the API echoes, not the requested ones", () => {
    // Asked for limit=500 → the API clamps to its max (100) and echoes it.
    expect(nextPageOffset({ limit: 100, offset: 100, total: 250, has_more: true })).toBe(200);
  });
});

describe("previousPageOffset", () => {
  it("steps back by one page and never below zero", () => {
    expect(previousPageOffset(page(20, 20, 42))).toBe(0);
    expect(previousPageOffset(page(40, 20, 42))).toBe(20);
  });

  it("returns null on the first page", () => {
    expect(previousPageOffset(page(0, 20, 42))).toBeNull();
  });

  it("clamps a partial step back to zero", () => {
    expect(previousPageOffset(page(5, 20, 42))).toBe(0);
  });
});

describe("buildQuery", () => {
  it("omits undefined, null and empty strings; keeps false and zero", () => {
    expect(
      buildQuery({
        search: "",
        archived: false,
        offset: 0,
        limit: undefined,
        extra: null,
        term: "release",
      }),
    ).toEqual({ archived: "false", offset: "0", term: "release" });
  });

  it("stringifies booleans and numbers the way a query string needs them", () => {
    expect(buildQuery({ archived: true, limit: 20 })).toEqual({
      archived: "true",
      limit: "20",
    });
  });

  it("produces an empty object when everything is absent", () => {
    expect(buildQuery({ search: undefined, offset: undefined })).toEqual({});
  });
});

describe("NOTES_PAGE_SIZE", () => {
  it("stays within the API's published bounds (default 20, max 100)", () => {
    expect(NOTES_PAGE_SIZE).toBeGreaterThanOrEqual(1);
    expect(NOTES_PAGE_SIZE).toBeLessThanOrEqual(100);
  });
});
