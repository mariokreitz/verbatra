import type { z } from "zod";
import { RPC_METHOD_NAMES, type RpcMethodName, rpcParamsSchemas } from "../shared/rpc/contract.js";
import type { RpcInFlightGuard } from "./in-flight-guard.js";
import type { RpcRateLimiter } from "./rate-limiter.js";
import { redact } from "./redaction.js";
import type { HandlersRegistry, RpcHandlerDeps } from "./rpc.js";

/** The transport-level result of a POST /rpc call: a status and a body ready to write as-is. */
export interface RpcResult {
  readonly statusCode: number;
  readonly body: string;
}

const REQUEST_INVALID_MESSAGE = "The request body must be JSON shaped as { method, params }.";
const METHOD_UNKNOWN_MESSAGE = "The requested method is not recognized.";
const PARAMS_INVALID_MESSAGE = "The request parameters failed validation.";
const RATE_LIMITED_MESSAGE = "Too many calls to this method; wait before retrying.";
const ALREADY_IN_PROGRESS_MESSAGE =
  "A matching call is already in progress; wait for it to finish.";
const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred.";

/** One failing zod issue, carrying only its path and code: never a message or a received value (G9). */
interface ParsedIssue {
  readonly path: readonly string[];
  readonly code: string;
}

interface RawRequestShape {
  readonly method: string;
  readonly params: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses the body as JSON and checks it is shaped as `{ method: string, params? }`; anything else is `undefined`. */
function parseRequestShape(body: Buffer): RawRequestShape | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    return undefined;
  }
  if (!isPlainObject(parsed)) {
    return undefined;
  }
  const method = parsed.method;
  if (typeof method !== "string") {
    return undefined;
  }
  return { method, params: parsed.params };
}

function isKnownMethod(method: string): method is RpcMethodName {
  return (RPC_METHOD_NAMES as readonly string[]).includes(method);
}

function toParsedIssues(error: z.ZodError): ParsedIssue[] {
  return error.issues.map((issue) => ({ path: issue.path.map(String), code: issue.code }));
}

function jsonEnvelope(statusCode: number, body: unknown): RpcResult {
  return { statusCode, body: JSON.stringify(body) };
}

function okEnvelope(result: unknown): RpcResult {
  return jsonEnvelope(200, { ok: true, result });
}

function errorEnvelope(
  statusCode: number,
  code: string,
  message: string,
  issues?: readonly ParsedIssue[],
): RpcResult {
  const error = issues === undefined ? { code, message } : { code, message, issues };
  return jsonEnvelope(statusCode, { ok: false, error });
}

/** The minimal shape of an SdkError, an AdapterError, or a ProviderError: a `name` and a string `code`. */
interface DomainError {
  readonly code: string;
  readonly message: string;
}

/**
 * Structurally detects an SdkError (`@verbatra/sdk`), an AdapterError (`@verbatra/format-adapters`),
 * or a ProviderError (`@verbatra/ai-providers`) without importing any of the three: studio must
 * never depend on ai-providers, format-adapters, or exchange (dependency direction). All three
 * classes fix `name` to their class name and carry a string `code`; that is exactly what is
 * checked here, so the check stays correct without the import.
 *
 * ProviderError joins this check because `translation.retranslateEntry` is the first Studio RPC
 * method that can reach a provider call at all: the underlying provider throws a ProviderError on
 * a failure (an invalid or missing key, a rate limit, a malformed response), and that class is
 * already secret-free by construction (see its own redaction guarantee), so routing it through the
 * same structured-error and redaction backstop as SdkError and AdapterError is correct, not a new
 * bypass.
 */
function isDomainError(error: unknown): error is DomainError {
  return (
    error instanceof Error &&
    (error.name === "SdkError" ||
      error.name === "AdapterError" ||
      error.name === "ProviderError") &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

/**
 * Maps a handler throw to its response: a domain error (SdkError or AdapterError) rides HTTP 200
 * with `ok: false` and its code and redacted message; anything else is an unexpected failure,
 * answered with a fixed 500 body that never echoes the original error (it is not logged here
 * either; a caller that wants server-side detail logs the caught error itself).
 */
function mapHandlerError(error: unknown): RpcResult {
  if (isDomainError(error)) {
    return jsonEnvelope(200, {
      ok: false,
      error: { code: error.code, message: redact(error.message) },
    });
  }
  return errorEnvelope(500, "INTERNAL", INTERNAL_ERROR_MESSAGE);
}

async function invokeHandler(
  method: RpcMethodName,
  params: unknown,
  deps: RpcHandlerDeps,
  handlers: HandlersRegistry,
  rateLimiter: RpcRateLimiter | undefined,
  inFlightGuard: RpcInFlightGuard | undefined,
): Promise<RpcResult> {
  const schema = rpcParamsSchemas[method];
  const parsedParams = schema.safeParse(params);
  if (!parsedParams.success) {
    return errorEnvelope(
      400,
      "PARAMS_INVALID",
      PARAMS_INVALID_MESSAGE,
      toParsedIssues(parsedParams.error),
    );
  }
  const handler = handlers[method];
  if (handler === undefined) {
    return errorEnvelope(400, "METHOD_UNKNOWN", METHOD_UNKNOWN_MESSAGE);
  }
  // The rate-limit check runs after method resolution (a disabled write method already answered
  // METHOD_UNKNOWN above, so there is nothing to limit) but before the handler is ever invoked: a
  // rate-limited call never reaches the sdk seam, the provider, or disk.
  if (rateLimiter?.tryAcquire(method) === false) {
    return errorEnvelope(429, "RATE_LIMITED", RATE_LIMITED_MESSAGE);
  }
  // Same layer as the rate limiter, checked immediately before the handler: a method with no
  // configured guard (every method but translation.translatePending today) always passes. A
  // rejected call here never marks anything itself, so it never needs to call leave().
  if (inFlightGuard?.tryEnter(method) === false) {
    return errorEnvelope(409, "ALREADY_IN_PROGRESS", ALREADY_IN_PROGRESS_MESSAGE);
  }
  try {
    // Sound at runtime only: `handler` and `parsedParams.data` are both looked up by the same
    // `method` key, so the params a schema produced always match what its own handler expects.
    // The type system cannot express that correlation across a dynamically chosen union key, so
    // the argument is asserted to `never` (assignable to any parameter type) at this one call site.
    const result = await handler(parsedParams.data as never, deps);
    return okEnvelope(result);
  } catch (error) {
    return mapHandlerError(error);
  } finally {
    inFlightGuard?.leave(method);
  }
}

/**
 * The complete POST /rpc envelope (G8): parses and shape-checks the body, resolves the method
 * against the shared contract, validates its parameters, applies the per-method rate limit and
 * in-flight guard, dispatches to the matching handler, and maps every outcome, a success, a
 * domain error, or an unexpected throw, to the fixed response envelope. `handlers` is the
 * capability-gated registry `createRpcHandlers` built at startup (see `rpc.ts`); there is no
 * module-level default, so an absent handler for a disabled write method degrades to
 * `METHOD_UNKNOWN` exactly like any other unregistered method. `rateLimiter` and `inFlightGuard`
 * are both optional so tests exercising other envelope rows do not need to construct either.
 */
export async function dispatchRpc(
  body: Buffer,
  deps: RpcHandlerDeps,
  handlers: HandlersRegistry,
  rateLimiter?: RpcRateLimiter,
  inFlightGuard?: RpcInFlightGuard,
): Promise<RpcResult> {
  const request = parseRequestShape(body);
  if (request === undefined) {
    return errorEnvelope(400, "REQUEST_INVALID", REQUEST_INVALID_MESSAGE);
  }
  if (!isKnownMethod(request.method)) {
    return errorEnvelope(400, "METHOD_UNKNOWN", METHOD_UNKNOWN_MESSAGE);
  }
  return invokeHandler(request.method, request.params, deps, handlers, rateLimiter, inFlightGuard);
}

/**
 * Transport-level extension point for POST /rpc. A request reaches this function only after
 * passing the host, origin, authentication, content-type, and body-size gate.
 */
export function handleRpcBody(
  body: Buffer,
  deps: RpcHandlerDeps,
  handlers: HandlersRegistry,
  rateLimiter?: RpcRateLimiter,
  inFlightGuard?: RpcInFlightGuard,
): Promise<RpcResult> {
  return dispatchRpc(body, deps, handlers, rateLimiter, inFlightGuard);
}
