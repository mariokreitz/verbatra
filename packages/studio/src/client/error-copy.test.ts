import { describe, expect, it } from "vitest";
import { copyForErrorCode, ERROR_CODE_COPY, resolveErrorCopy } from "./error-copy.js";

const REACHABLE_TODAY_CODES = [
  "REQUEST_INVALID",
  "METHOD_UNKNOWN",
  "PARAMS_INVALID",
  "INTERNAL",
  "SESSION_EXPIRED",
  "UNKNOWN_FORMAT",
  "SOURCE_UNREADABLE",
  "SOURCE_INVALID",
  "LOCK_FILE_INVALID",
  "UNKNOWN_LOCALE",
  "INVALID_JSON",
  "INVALID_YAML",
  "INVALID_XML",
  "INVALID_STRUCTURE",
  "MAX_DEPTH_EXCEEDED",
  "INPUT_TOO_LARGE",
  "MIXED_STRUCTURE",
];

const FORWARD_LOOKING_CODES = ["RATE_LIMITED", "AUTH_FAILED", "TIMEOUT"];

const GENERIC_MESSAGE = "Something went wrong on the server.";

describe("copyForErrorCode", () => {
  it.each(
    REACHABLE_TODAY_CODES,
  )("has distinct, specific copy for the reachable-today code %s", (code) => {
    const copy = copyForErrorCode(code);

    expect(copy).toBeDefined();
    expect(copy).not.toBe(GENERIC_MESSAGE);
    expect(copy?.length).toBeGreaterThan(0);
  });

  it.each(
    FORWARD_LOOKING_CODES,
  )("has distinct, specific copy for the forward-looking code %s", (code) => {
    const copy = copyForErrorCode(code);

    expect(copy).toBeDefined();
    expect(copy).not.toBe(GENERIC_MESSAGE);
  });

  it("returns undefined for a code not in the table", () => {
    expect(copyForErrorCode("SOMETHING_UNKNOWN")).toBeUndefined();
  });

  it("every code in the table maps to a non-empty string", () => {
    for (const copy of Object.values(ERROR_CODE_COPY)) {
      expect(typeof copy).toBe("string");
      expect(copy.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveErrorCopy", () => {
  it("returns the specific copy for a known code", () => {
    const resolved = resolveErrorCopy({ code: "SESSION_EXPIRED", message: GENERIC_MESSAGE });

    expect(resolved).toBe(copyForErrorCode("SESSION_EXPIRED"));
    expect(resolved).not.toBe(GENERIC_MESSAGE);
  });

  it("falls back to the error's own message for an unmapped code", () => {
    const resolved = resolveErrorCopy({ code: "SOMETHING_UNKNOWN", message: GENERIC_MESSAGE });

    expect(resolved).toBe(GENERIC_MESSAGE);
  });
});
