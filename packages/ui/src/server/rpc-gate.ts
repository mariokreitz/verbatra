import type { z } from "zod";
import { RPC_METHOD_NAMES, type RpcMethodName, rpcParamsSchemas } from "../shared/rpc/contract.js";
import { redact } from "./redaction.js";
import { type RpcHandler, type RpcHandlerDeps, rpcHandlers } from "./rpc.js";

/** The transport-level result of a POST /rpc call: a status and a body ready to write as-is. */
export interface RpcResult {
  readonly statusCode: number;
  readonly body: string;
}

type HandlersRegistry = { readonly [M in RpcMethodName]?: RpcHandler<M> };

const REQUEST_INVALID_MESSAGE = "The request body must be JSON shaped as { method, params }.";
const METHOD_UNKNOWN_MESSAGE = "The requested method is not recognized.";
const PARAMS_INVALID_MESSAGE = "The request parameters failed validation.";
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

/** The minimal shape of an SdkError or an AdapterError: a `name` and a string `code`. */
interface DomainError {
  readonly code: string;
  readonly message: string;
}

/**
 * Structurally detects an SdkError (`@verbatra/sdk`) or an AdapterError (`@verbatra/format-adapters`)
 * without importing either class: ui must never depend on ai-providers, format-adapters, or
 * exchange (dependency direction). Both classes fix `name` to their class name and carry a string
 * `code`; that is exactly what is checked here, so the check stays correct without the import.
 */
function isDomainError(error: unknown): error is DomainError {
  return (
    error instanceof Error &&
    (error.name === "SdkError" || error.name === "AdapterError") &&
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
  try {
    // Sound at runtime only: `handler` and `parsedParams.data` are both looked up by the same
    // `method` key, so the params a schema produced always match what its own handler expects.
    // The type system cannot express that correlation across a dynamically chosen union key, so
    // the argument is asserted to `never` (assignable to any parameter type) at this one call site.
    const result = await handler(parsedParams.data as never, deps);
    return okEnvelope(result);
  } catch (error) {
    return mapHandlerError(error);
  }
}

/**
 * The complete POST /rpc envelope (G8): parses and shape-checks the body, resolves the method
 * against the shared contract, validates its parameters, dispatches to the matching handler, and
 * maps every outcome, a success, a domain error, or an unexpected throw, to the fixed response
 * envelope. `handlers` defaults to the production registry; tests inject a stub registry to
 * exercise every envelope row without needing a real handler for every method.
 */
export async function dispatchRpc(
  body: Buffer,
  deps: RpcHandlerDeps,
  handlers: HandlersRegistry = rpcHandlers,
): Promise<RpcResult> {
  const request = parseRequestShape(body);
  if (request === undefined) {
    return errorEnvelope(400, "REQUEST_INVALID", REQUEST_INVALID_MESSAGE);
  }
  if (!isKnownMethod(request.method)) {
    return errorEnvelope(400, "METHOD_UNKNOWN", METHOD_UNKNOWN_MESSAGE);
  }
  return invokeHandler(request.method, request.params, deps, handlers);
}

/**
 * Transport-level extension point for POST /rpc. A request reaches this function only after
 * passing the host, origin, authentication, content-type, and body-size gate.
 */
export function handleRpcBody(body: Buffer, deps: RpcHandlerDeps): Promise<RpcResult> {
  return dispatchRpc(body, deps);
}
