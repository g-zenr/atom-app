/**
 * Small pure helpers around the ATOM pagination envelope.
 *
 * Contract: `docs/api/conventions.md` §5 in the atom/api repository.
 * Every list endpoint returns `{ items, pagination: { limit, offset, total, has_more } }`
 * where `limit`/`offset` are the values **applied after clamping** — a client
 * must page with those, not with the values it asked for. `has_more` is
 * `offset + limit < total`.
 */

/** The `pagination` block shared by every list endpoint. */
export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}

/**
 * The offset of the page after this one, or `null` when this is the last page.
 *
 * The API's own rule is `has_more = offset + limit < total`; the client pages
 * by `has_more`, never by comparing against `total` itself.
 */
export function nextPageOffset(pagination: PaginationMeta): number | null {
  return pagination.has_more ? pagination.offset + pagination.limit : null;
}

/** The offset of the page before this one, or `null` when already on the first. */
export function previousPageOffset(pagination: PaginationMeta): number | null {
  if (pagination.offset <= 0) return null;
  return Math.max(0, pagination.offset - pagination.limit);
}

/** A value usable as a query parameter; `undefined` and the empty string mean "omit". */
export type QueryValue = string | number | boolean | undefined | null;

/**
 * Builds a query-object from entries, dropping absent values.
 *
 * The empty string is dropped as well: for `search` the API treats an empty
 * term as "no filter", and omitting the parameter keeps URLs clean.
 * `false` is kept — an explicit filter value is meaningful.
 */
export function buildQuery(entries: Record<string, QueryValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.length === 0) continue;
    out[key] = String(value);
  }
  return out;
}

/** The page size requested from list endpoints. The API clamps it to its own bound. */
export const NOTES_PAGE_SIZE = 20;
