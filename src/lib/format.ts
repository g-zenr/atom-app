/**
 * Display formatting helpers. Pure and client-safe.
 *
 * The API renders every timestamp as RFC 3339 UTC (conventions.md §6). The UI
 * formats in UTC as well, so a timestamp reads the same wherever the server
 * that rendered the page happens to sit.
 */

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Formats an RFC 3339 timestamp for display; an unusable value is shown raw. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatter.format(date)} UTC`;
}

/** A short single-line preview of note content for list items. */
export function snippet(content: string, maxLength = 160): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength).trimEnd()}…`;
}
