export interface ToolRegistrationFailure {
  readonly tool: string;
  readonly errorName: string;
  readonly message: string;
}

export interface AgentToolsRegistration {
  readonly attempted: number;
  readonly registered: readonly string[];
  readonly failures: readonly ToolRegistrationFailure[];
}

export interface RegistrationLogger {
  error(message: string): void;
}

export const NOTHING_ATTEMPTED: AgentToolsRegistration = {
  attempted: 0,
  registered: [],
  failures: [],
};

function readStringProperty(value: unknown, property: string): string | undefined {
  if (typeof value !== "object" || value === null || !(property in value)) {
    return undefined;
  }
  const candidate: unknown = Reflect.get(value, property);
  return typeof candidate === "string" ? candidate : undefined;
}

function stringifyValue(value: unknown): string {
  return typeof value === "symbol" ? value.toString() : String(value);
}

function describeError(error: unknown): { errorName: string; message: string } {
  return {
    errorName: readStringProperty(error, "name") ?? "Error",
    message: readStringProperty(error, "message") ?? stringifyValue(error),
  };
}

export function toRegistrationFailure(tool: string, error: unknown): ToolRegistrationFailure {
  return { tool, ...describeError(error) };
}

export function formatRegistrationFailure(failure: ToolRegistrationFailure): string {
  return `${failure.tool} (${failure.errorName}: ${failure.message})`;
}

export function formatRegistrationReport(registration: AgentToolsRegistration): string {
  const detail = registration.failures.map(formatRegistrationFailure).join("; ");
  return `Verbatra agent tools: ${registration.failures.length} of ${registration.attempted} tool registrations failed. ${detail}`;
}

export function reportAgentToolsRegistration(
  registration: AgentToolsRegistration,
  logger: RegistrationLogger = console,
): void {
  if (registration.failures.length === 0) {
    return;
  }
  logger.error(formatRegistrationReport(registration));
}

export function reportAgentToolsStartupFailure(
  error: unknown,
  logger: RegistrationLogger = console,
): void {
  const { errorName, message } = describeError(error);
  logger.error(`Verbatra agent tools: registration did not start (${errorName}: ${message}).`);
}
