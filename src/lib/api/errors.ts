/**
 * The ATOM error envelope, mapped to a typed `ApiError`.
 *
 * Contract: `docs/api/error-contract.md` in the atom/api repository.
 * Every non-2xx response of the API carries the same shape:
 *
 *   { "error": { "code": "...", "message": "...", "details?: [{ field, message }] } }
 *
 * Rules the client honors:
 * - `error.code` is stable and machine-readable; a client switches on it.
 * - `error.message` may be reworded; never parse it, never treat it as the
 *   only user-facing text.
 * - `details` is omitted entirely when empty, not rendered as `[]`.
 * - A body that parses as JSON but does not match the contract reports a
 *   single violation naming the field `body`.
 * - Every API response is treated as untrusted input: the parsing below
 *   validates the shape before trusting any field.
 */

/** Every stable error code the API publishes. */
export const API_ERROR_CODES = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "payload_too_large",
  "validation_failed",
  "rate_limited",
  "timeout",
  "database_error",
  "internal_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** One failing field, as published in `error.details[]` of a 422. */
export interface FieldViolation {
  field: string;
  message: string;
}

/** The wire shape of the envelope. `details` is optional and omitted when empty. */
export interface ErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: FieldViolation[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrows an unknown value to a known error code; anything else is `internal_error`. */
export function asApiErrorCode(value: unknown): ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(value as string)
    ? (value as ApiErrorCode)
    : "internal_error";
}

/**
 * Parses a response body into the error envelope, defensively.
 *
 * A payload that does not match the contract (a proxy HTML error page, an
 * empty body, a differently shaped JSON object) still produces an `ApiError`,
 * with the code `internal_error` and a generic message, so the caller always
 * has one error type to handle.
 */
export function parseErrorEnvelope(
  status: number,
  payload: unknown,
  fallbackMessage = "The request could not be completed.",
  retryAfterSeconds?: number,
): ApiError {
  if (isRecord(payload) && isRecord(payload.error)) {
    const raw = payload.error;
    const code = asApiErrorCode(raw.code);
    const message = typeof raw.message === "string" && raw.message.length > 0
      ? raw.message
      : fallbackMessage;

    let details: FieldViolation[] = [];
    if (Array.isArray(raw.details)) {
      details = raw.details.flatMap((entry: unknown) => {
        if (
          isRecord(entry) &&
          typeof entry.field === "string" &&
          typeof entry.message === "string"
        ) {
          return [{ field: entry.field, message: entry.message }];
        }
        // An entry that does not match the contract is dropped, never trusted.
        return [];
      });
    }

    return new ApiError(status, code, message, details, retryAfterSeconds);
  }

  return new ApiError(status, "internal_error", fallbackMessage, [], retryAfterSeconds);
}

/**
 * A 422 (or any error) whose details name request fields.
 *
 * The `body` pseudo-field is the API's answer for "the JSON parsed but the
 * object does not match the contract" (error-contract.md §3). Callers should
 * show those as a form-level message, not next to a specific input.
 */
export function fieldErrors(error: ApiError): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const violation of error.details) {
    (grouped[violation.field] ??= []).push(violation.message);
  }
  return grouped;
}

/** The typed error every API call rejects with. */
export class ApiError extends Error {
  /** The HTTP status the envelope travelled with. */
  readonly status: number;
  /** The stable machine-readable code from the envelope. */
  readonly code: ApiErrorCode;
  /** Field-level violations; empty when the envelope carried none. */
  readonly details: FieldViolation[];
  /** Seconds until the rate-limit window resets; from `retry-after` on a 429. */
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details: FieldViolation[] = [],
    retryAfterSeconds?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** The one status the client treats as "session expired". */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === "unauthorized";
  }
}

/**
 * Re-publishes an `ApiError` as the standard envelope — used by the BFF route
 * handlers, so the browser sees the same error shape the API defines.
 * `details` is omitted entirely when empty, mirroring the contract.
 */
export function toErrorEnvelope(error: ApiError): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if (error.details.length > 0) envelope.error.details = error.details;
  return envelope;
}
