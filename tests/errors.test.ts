import { describe, expect, it } from "vitest";

import { ApiError, asApiErrorCode, fieldErrors, parseErrorEnvelope, toErrorEnvelope } from "../src/lib/api/errors";

describe("parseErrorEnvelope", () => {
  it("parses the standard envelope with field details", () => {
    const error = parseErrorEnvelope(422, {
      error: {
        code: "validation_failed",
        message: "The request failed validation.",
        details: [
          { field: "password", message: "must be at least 12 characters long" },
          { field: "password", message: "must contain at least one uppercase letter" },
        ],
      },
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.code).toBe("validation_failed");
    expect(error.message).toBe("The request failed validation.");
    expect(error.details).toHaveLength(2);
    expect(error.details[0]).toEqual({
      field: "password",
      message: "must be at least 12 characters long",
    });
    expect(error.isUnauthorized).toBe(false);
  });

  it("accepts an envelope without details (details are omitted when empty)", () => {
    const error = parseErrorEnvelope(404, {
      error: { code: "not_found", message: "The requested note does not exist." },
    });

    expect(error.code).toBe("not_found");
    expect(error.details).toEqual([]);
  });

  it("marks 401 unauthorized as session-expired", () => {
    const error = parseErrorEnvelope(401, {
      error: { code: "unauthorized", message: "Authentication is required." },
    });

    expect(error.isUnauthorized).toBe(true);
  });

  it("maps an unknown code to internal_error instead of trusting it", () => {
    const error = parseErrorEnvelope(500, {
      error: { code: "totally_new_code", message: "Something new." },
    });

    expect(error.code).toBe("internal_error");
    expect(error.message).toBe("Something new.");
  });

  it("degrades a non-JSON body (proxy HTML page, empty body) to a generic internal error", () => {
    for (const payload of [undefined, null, "Gateway timeout", 42, []]) {
      const error = parseErrorEnvelope(502, payload);
      expect(error.code).toBe("internal_error");
      expect(error.status).toBe(502);
      expect(error.details).toEqual([]);
    }
  });

  it("keeps the envelope's own message only when it is a non-empty string", () => {
    const emptyMessage = parseErrorEnvelope(500, {
      error: { code: "internal_error", message: "" },
    });
    expect(emptyMessage.message).toBe("The request could not be completed.");

    const wrongType = parseErrorEnvelope(500, {
      error: { code: "internal_error", message: 123 },
    });
    expect(wrongType.message).toBe("The request could not be completed.");
  });

  it("drops malformed detail entries rather than trusting them", () => {
    const error = parseErrorEnvelope(422, {
      error: {
        code: "validation_failed",
        message: "The request failed validation.",
        details: [
          { field: "title", message: "must not be blank" },
          { field: 7, message: "not a string field" },
          "garbage",
          null,
        ],
      },
    });

    expect(error.details).toEqual([{ field: "title", message: "must not be blank" }]);
  });
});

describe("fieldErrors", () => {
  it("groups violations per field, preserving repeats per broken rule", () => {
    const error = parseErrorEnvelope(422, {
      error: {
        code: "validation_failed",
        message: "The request failed validation.",
        details: [
          { field: "password", message: "must be at least 12 characters long" },
          { field: "password", message: "must contain at least one uppercase letter" },
          { field: "email", message: "is not a usable email address" },
        ],
      },
    });

    expect(fieldErrors(error)).toEqual({
      password: [
        "must be at least 12 characters long",
        "must contain at least one uppercase letter",
      ],
      email: ["is not a usable email address"],
    });
  });

  it("keeps the `body` pseudo-field apart so forms can show it at form level", () => {
    const error = parseErrorEnvelope(422, {
      error: {
        code: "validation_failed",
        message: "The request failed validation.",
        details: [
          { field: "body", message: "unknown variant `archived`, expected one of `open`" },
        ],
      },
    });

    expect(fieldErrors(error)["body"]).toHaveLength(1);
  });
});

describe("toErrorEnvelope", () => {
  it("re-publishes the envelope with details omitted when empty", () => {
    const withoutDetails = toErrorEnvelope(new ApiError(404, "not_found", "No such note."));
    expect(withoutDetails).toEqual({
      error: { code: "not_found", message: "No such note." },
    });
    expect("details" in withoutDetails.error).toBe(false);
  });

  it("carries details when present", () => {
    const withDetails = toErrorEnvelope(
      new ApiError(422, "validation_failed", "Failed.", [
        { field: "title", message: "must not be blank" },
      ]),
    );
    expect(withDetails.error.details).toEqual([
      { field: "title", message: "must not be blank" },
    ]);
  });
});

describe("asApiErrorCode", () => {
  it("accepts every published code and refuses anything else", () => {
    expect(asApiErrorCode("validation_failed")).toBe("validation_failed");
    expect(asApiErrorCode("rate_limited")).toBe("rate_limited");
    expect(asApiErrorCode("UNAUTHORIZED")).toBe("internal_error");
    expect(asApiErrorCode(undefined)).toBe("internal_error");
  });
});
