import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentToolsRegistration, RegistrationLogger } from "./registration-report.js";
import {
  formatRegistrationFailure,
  formatRegistrationReport,
  NOTHING_ATTEMPTED,
  reportAgentToolsRegistration,
  reportAgentToolsStartupFailure,
  toRegistrationFailure,
} from "./registration-report.js";

/** A stand-in for the browser's `DOMException`: only the structural `name` matters here. */
function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function makeLogger(): { logger: RegistrationLogger; messages: string[] } {
  const messages: string[] = [];
  return { logger: { error: (message) => messages.push(message) }, messages };
}

const TWO_FAILED: AgentToolsRegistration = {
  attempted: 11,
  registered: ["verbatra_status_check"],
  failures: [
    { tool: "verbatra_project_snapshot", errorName: "SecurityError", message: "not permitted" },
    { tool: "verbatra_key_value", errorName: "InvalidStateError", message: "already registered" },
  ],
};

const ALL_REGISTERED: AgentToolsRegistration = {
  attempted: 11,
  registered: ["verbatra_project_snapshot"],
  failures: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toRegistrationFailure", () => {
  it("keeps the tool name and reads the name and message off the rejected value", () => {
    const failure = toRegistrationFailure(
      "verbatra_key_value",
      namedError("InvalidStateError", "tool already registered"),
    );

    expect(failure).toEqual({
      tool: "verbatra_key_value",
      errorName: "InvalidStateError",
      message: "tool already registered",
    });
  });

  it("reads a plain object carrying a name and a message, as a cross-realm error would", () => {
    const failure = toRegistrationFailure("verbatra_lock_state", {
      name: "SecurityError",
      message: "refused",
    });

    expect(failure.errorName).toBe("SecurityError");
    expect(failure.message).toBe("refused");
  });

  it("falls back to a generic name and the value's string form for a non-error rejection", () => {
    expect(toRegistrationFailure("verbatra_lock_state", "boom")).toEqual({
      tool: "verbatra_lock_state",
      errorName: "Error",
      message: "boom",
    });
    expect(toRegistrationFailure("verbatra_lock_state", undefined).message).toBe("undefined");
    expect(toRegistrationFailure("verbatra_lock_state", { name: 7 }).errorName).toBe("Error");
  });

  it("survives a rejected symbol, which a bare String() conversion would throw on", () => {
    const failure = toRegistrationFailure("verbatra_lock_state", Symbol("rejected"));

    expect(failure.errorName).toBe("Error");
    expect(failure.message).toBe("Symbol(rejected)");
  });
});

describe("registration report copy", () => {
  it("renders one failure as the tool name with its error name and message", () => {
    expect(
      formatRegistrationFailure({
        tool: "verbatra_key_value",
        errorName: "SecurityError",
        message: "refused",
      }),
    ).toBe("verbatra_key_value (SecurityError: refused)");
  });

  it("counts the failures against the attempts and names every failing tool", () => {
    const line = formatRegistrationReport(TWO_FAILED);

    expect(line).toContain("2 of 11 tool registrations failed");
    expect(line).toContain("verbatra_project_snapshot (SecurityError: not permitted)");
    expect(line).toContain("verbatra_key_value (InvalidStateError: already registered)");
  });
});

describe("reportAgentToolsRegistration", () => {
  it("writes one console error naming every failing tool and its error name", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    reportAgentToolsRegistration(TWO_FAILED);

    expect(consoleError).toHaveBeenCalledTimes(1);
    const [message] = consoleError.mock.calls.at(0) ?? [];
    expect(message).toContain("verbatra_project_snapshot");
    expect(message).toContain("SecurityError");
    expect(message).toContain("verbatra_key_value");
    expect(message).toContain("InvalidStateError");
  });

  it("says nothing at all when every registration succeeded", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    reportAgentToolsRegistration(ALL_REGISTERED);
    reportAgentToolsRegistration(NOTHING_ATTEMPTED);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("writes to an injected logger when one is given", () => {
    const { logger, messages } = makeLogger();

    reportAgentToolsRegistration(TWO_FAILED, logger);

    expect(messages).toHaveLength(1);
    expect(messages.at(0)).toContain("2 of 11 tool registrations failed");
  });
});

describe("reportAgentToolsStartupFailure", () => {
  it("writes one console error naming the error that stopped the pass", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    reportAgentToolsStartupFailure(namedError("TypeError", "fetch failed"));

    expect(consoleError).toHaveBeenCalledTimes(1);
    const [message] = consoleError.mock.calls.at(0) ?? [];
    expect(message).toContain("registration did not start");
    expect(message).toContain("TypeError: fetch failed");
  });

  it("writes to an injected logger when one is given", () => {
    const { logger, messages } = makeLogger();

    reportAgentToolsStartupFailure("offline", logger);

    expect(messages.at(0)).toContain("Error: offline");
  });
});
