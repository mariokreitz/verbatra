/**
 * The diagnostic half of the WebMCP adapter: the shape of a failed tool registration, the console
 * reporting, and the copy both the console and the dashboard read from.
 *
 * A registration failure is otherwise invisible. The tools surface is opt-in, so an operator who
 * asked for it and got nothing has no way to tell a rejected registration apart from a working
 * surface no agent happens to be using. Everything here exists so that failure names itself: which
 * tool, which error, and how many of the attempted registrations went the same way.
 */

/** One tool whose WebMCP registration did not complete. */
export interface ToolRegistrationFailure {
  /** The advertised tool name, the same string `registerTool` was called with. */
  readonly tool: string;
  /** The rejected value's `name`, for example `SecurityError` or `InvalidStateError`. */
  readonly errorName: string;
  /** The rejected value's `message`, or its string form when it carries none. */
  readonly message: string;
}

/**
 * The outcome of one registration pass. `attempted` counts only the tools the pass actually tried
 * to register, so it is 11 without the spend capability and 13 with it, and 0 when the pass no-ops
 * (no WebMCP surface, or the server did not opt in). `registered` plus `failures` always accounts
 * for every attempt: one failing tool never cancels the ones after it.
 */
export interface AgentToolsRegistration {
  readonly attempted: number;
  readonly registered: readonly string[];
  readonly failures: readonly ToolRegistrationFailure[];
}

/** The minimal console surface the reporting needs, injectable so tests do not spy on a global. */
export interface RegistrationLogger {
  error(message: string): void;
}

/** The registration pass that never got as far as attempting a single tool. */
export const NOTHING_ATTEMPTED: AgentToolsRegistration = {
  attempted: 0,
  registered: [],
  failures: [],
};

/** Reads a string property off an unknown thrown value without asserting its type. */
function readStringProperty(value: unknown, property: string): string | undefined {
  if (typeof value !== "object" || value === null || !(property in value)) {
    return undefined;
  }
  const candidate: unknown = Reflect.get(value, property);
  return typeof candidate === "string" ? candidate : undefined;
}

/** Stringifies any thrown value, including a symbol, which `String()` alone would throw on. */
function stringifyValue(value: unknown): string {
  return typeof value === "symbol" ? value.toString() : String(value);
}

/**
 * Describes a rejected value structurally rather than through `instanceof Error`: the browser
 * rejects `registerTool` with a `DOMException`, whose useful identity is its `name`, and a test
 * double or a cross-realm error satisfies the same structural read.
 */
function describeError(error: unknown): { errorName: string; message: string } {
  return {
    errorName: readStringProperty(error, "name") ?? "Error",
    message: readStringProperty(error, "message") ?? stringifyValue(error),
  };
}

/** Describes one failed registration, keeping the tool name the caller still has in hand. */
export function toRegistrationFailure(tool: string, error: unknown): ToolRegistrationFailure {
  return { tool, ...describeError(error) };
}

/** One failure as `name (ErrorName: message)`, the unit both report lines are built from. */
export function formatRegistrationFailure(failure: ToolRegistrationFailure): string {
  return `${failure.tool} (${failure.errorName}: ${failure.message})`;
}

/**
 * The full console line: how many of the attempted registrations failed, then every failing tool
 * with its error name and message. One aggregate line rather than one line per tool, because a
 * shared cause (an origin or permission rejection, say) fails all of them identically and would
 * otherwise bury the console in the same message repeated eleven or thirteen times.
 */
export function formatRegistrationReport(registration: AgentToolsRegistration): string {
  const detail = registration.failures.map(formatRegistrationFailure).join("; ");
  return `Verbatra agent tools: ${registration.failures.length} of ${registration.attempted} tool registrations failed. ${detail}`;
}

/**
 * Reports a registration pass to the console, and only when something failed, so the happy path
 * stays silent and the signal never becomes noise. Error level rather than warning level: the
 * surface is registered only because the operator explicitly asked for it, so its failure is a
 * failure of something requested, and error level is what browser console filters surface by
 * default.
 */
export function reportAgentToolsRegistration(
  registration: AgentToolsRegistration,
  logger: RegistrationLogger = console,
): void {
  if (registration.failures.length === 0) {
    return;
  }
  logger.error(formatRegistrationReport(registration));
}

/**
 * Reports a pass that never reached the per-tool loop, for example because the snapshot fetch that
 * decides whether the surface is opted in rejected at load.
 */
export function reportAgentToolsStartupFailure(
  error: unknown,
  logger: RegistrationLogger = console,
): void {
  const { errorName, message } = describeError(error);
  logger.error(`Verbatra agent tools: registration did not start (${errorName}: ${message}).`);
}
