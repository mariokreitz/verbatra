/**
 * The client-side WebMCP adapter: it registers each existing RPC method as a WebMCP tool on the
 * browser's `document.modelContext`, 1:1 over the shared `rpcClient`. It adds no business logic;
 * every tool is a thin wrapper that delegates to `rpcClient.call(method, params)`, which travels
 * the same authenticated server, the same input validation, and the same capability gate the
 * dashboard uses. Registration confers no authority the open, authenticated tab does not already
 * hold.
 *
 * The module is dependency-injected (the `modelContext` surface, the `rpcClient`, and the params
 * schemas are all passed in) so it is unit-testable without a DOM harness, and it declares its own
 * minimal structural WebMCP types rather than depending on any external types package or the DOM
 * lib.
 */
import { z } from "zod";
import type { RpcClient } from "../client/rpc-client.js";
import { STATUS_CHECK_METHOD } from "../shared/rpc/check.js";
import type { RpcMethodName, RpcParamsFor, rpcParamsSchemas } from "../shared/rpc/contract.js";
import { RPC_METHOD_NAMES } from "../shared/rpc/contract.js";
import { STATUS_DIFF_METHOD } from "../shared/rpc/diff.js";
import { EDIT_ENTRY_METHOD } from "../shared/rpc/edit-entry.js";
import { GLOSSARY_GET_METHOD } from "../shared/rpc/glossary.js";
import { HISTORY_LIST_METHOD } from "../shared/rpc/history.js";
import { KEY_INTEGRITY_METHOD } from "../shared/rpc/key-integrity.js";
import { KEY_VALUE_METHOD } from "../shared/rpc/key-value.js";
import { LOCK_STATE_METHOD } from "../shared/rpc/lock.js";
import { RETRANSLATE_ENTRY_METHOD } from "../shared/rpc/retranslate-entry.js";
import { REVIEW_QUEUE_METHOD } from "../shared/rpc/review-queue.js";
import { PROJECT_SNAPSHOT_METHOD } from "../shared/rpc/snapshot.js";
import { TRANSLATE_PENDING_METHOD } from "../shared/rpc/translate-pending.js";
import { USAGE_SUMMARY_METHOD } from "../shared/rpc/usage-summary.js";
import type { AgentToolsRegistration, ToolRegistrationFailure } from "./registration-report.js";
import { NOTHING_ATTEMPTED, toRegistrationFailure } from "./registration-report.js";

/** The annotations a WebMCP host reads to render a tool's consequence surface. */
export interface WebMcpToolAnnotations {
  /** True for a read-only method, false for a method that writes or spends provider budget. */
  readonly readOnlyHint?: boolean;
  /** True when the tool's result can contain project-authored text; over-setting is always safe. */
  readonly untrustedContentHint?: boolean;
}

/** The subset of a WebMCP tool definition this adapter provides to the host. */
export interface WebMcpTool {
  readonly name: string;
  readonly description: string;
  /** The tool input JSON Schema, derived from the method's zod params schema. */
  readonly inputSchema: object;
  /** Delegates to the shared rpc client and returns the stringified call result. */
  readonly execute: (input: unknown) => Promise<string>;
  readonly annotations?: WebMcpToolAnnotations;
}

/**
 * The per-registration options a WebMCP host reads. `signal` is the specification's only
 * unregistration mechanism: there is no `unregisterTool`, so a host takes a tool back when the
 * signal it was registered with aborts. Declared optional so a host that ignores it, and a test
 * double that never reads it, both stay valid.
 */
export interface RegisterToolOptions {
  /** Aborting it asks the host to unregister the tool it was passed with. */
  readonly signal?: AbortSignal;
}

/** The minimal `document.modelContext` surface this adapter needs: register one tool at a time. */
export interface ModelContext {
  /**
   * Registers one tool. The WebMCP surface answers with a promise (it is specified as returning
   * `Promise<undefined>`, and a browser running the surface was observed doing so), which is why
   * the caller awaits the result instead of discarding it: a discarded rejection is a floating
   * promise that no caller-side try/catch can ever see. The `void` arm keeps a synchronous host or
   * a test double representable, and awaiting covers both.
   *
   * `options` is optional on both sides: a host that implements only the one-argument form still
   * satisfies this type, since a function of fewer parameters is assignable to one of more.
   */
  registerTool(tool: WebMcpTool, options?: RegisterToolOptions): PromiseLike<void> | void;
}

/** Everything {@link registerAgentTools} needs, injected by the app so the module stays DOM-free. */
export interface RegisterAgentToolsDeps {
  /** The browser WebMCP surface, or `undefined` in a browser without WebMCP support. */
  readonly modelContext: ModelContext | undefined;
  /** The shared rpc client every tool delegates through. */
  readonly rpcClient: RpcClient;
  /** The single source of truth for each method's params schema, injected for testability. */
  readonly schemas: typeof rpcParamsSchemas;
  /**
   * The caller's teardown signal, passed straight through to every `registerTool` call so the
   * host unregisters the whole set when it aborts. Optional, and the controller stays with the
   * caller: lifecycle policy is the app's to decide, not this module's.
   */
  readonly signal?: AbortSignal;
}

/**
 * The static, DRY descriptor for one tool: everything that varies per method except the params
 * schema (derived) and the name (the method itself). `spendGated` marks the two methods registered
 * only when the server granted the spend capability.
 */
interface ToolDescriptor {
  readonly description: string;
  readonly readOnlyHint: boolean;
  readonly untrustedContentHint: boolean;
  readonly spendGated: boolean;
}

/**
 * One descriptor per method, keyed by the same constants the rpc contract uses so the table can
 * never drift out of step with the method set. `untrustedContentHint` is set on every tool whose
 * result can carry project-authored text (locale strings, key names, glossary terms, placeholder
 * tokens, commit subjects) and omitted only on the four whose payload is provably text-free.
 */
const TOOL_DESCRIPTORS: Record<RpcMethodName, ToolDescriptor> = {
  [PROJECT_SNAPSHOT_METHOD]: {
    description:
      "Read the project configuration snapshot: locales, format, provider, and capability flags.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [STATUS_CHECK_METHOD]: {
    description: "Report whether each target locale is in sync with the source.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [STATUS_DIFF_METHOD]: {
    description: "List the keys that are added, changed, or orphaned per target locale.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [GLOSSARY_GET_METHOD]: {
    description: "Read the configured glossary terms.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [LOCK_STATE_METHOD]: {
    description: "Read the lock file state summary.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [HISTORY_LIST_METHOD]: {
    description: "List recent git history entries for the locale files.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [KEY_INTEGRITY_METHOD]: {
    description: "Report placeholder and ICU integrity issues per key.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [REVIEW_QUEUE_METHOD]: {
    description: "List the entries flagged as needing human review.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [USAGE_SUMMARY_METHOD]: {
    description: "Read the provider usage and cost summary.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [KEY_VALUE_METHOD]: {
    description: "Read the source and target values for one key and locale.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [EDIT_ENTRY_METHOD]: {
    description:
      "Write a new target value for one key and locale locally, then re-run the acceptance checks.",
    readOnlyHint: false,
    untrustedContentHint: true,
    spendGated: false,
  },
  [RETRANSLATE_ENTRY_METHOD]: {
    description:
      "Spends provider budget: request a fresh provider translation for one key and locale.",
    readOnlyHint: false,
    untrustedContentHint: true,
    spendGated: true,
  },
  [TRANSLATE_PENDING_METHOD]: {
    description:
      "Spends provider budget: request provider translations for every pending entry across all target locales.",
    readOnlyHint: false,
    untrustedContentHint: true,
    spendGated: true,
  },
};

/**
 * Maps an RPC method name to an MCP-safe tool name. WebMCP `registerTool` and the model tool-use
 * pipeline enforce the `^[a-zA-Z0-9_-]{1,64}$` charset, which excludes the dot in the method names,
 * so the dot is replaced with an underscore and the shared `verbatra_` prefix namespaces the tools.
 * The mapping is stable and collision-free over the fixed thirteen-method set. The raw method name
 * is still what every `rpcClient.call` uses; only the advertised tool name is sanitized.
 */
function toToolName(method: RpcMethodName): string {
  return `verbatra_${method.replaceAll(".", "_")}`;
}

function buildAnnotations(descriptor: ToolDescriptor): WebMcpToolAnnotations {
  return {
    readOnlyHint: descriptor.readOnlyHint,
    ...(descriptor.untrustedContentHint ? { untrustedContentHint: true } : {}),
  };
}

/**
 * Builds one WebMCP tool for a method. `inputSchema` is derived from the injected params schema by
 * zod's native JSON Schema conversion, so it stays the single source of truth. `execute` returns
 * the whole rpc call result envelope stringified (the same payload the dashboard's own
 * `rpcClient.call` yields), preserving both success results and structured errors for the agent.
 */
function buildTool<M extends RpcMethodName>(
  method: M,
  descriptor: ToolDescriptor,
  deps: RegisterAgentToolsDeps,
): WebMcpTool {
  return {
    name: toToolName(method),
    description: descriptor.description,
    inputSchema: z.toJSONSchema(deps.schemas[method]),
    annotations: buildAnnotations(descriptor),
    execute: async (input: unknown): Promise<string> => {
      const result = await deps.rpcClient.call(method, input as RpcParamsFor<M>);
      return JSON.stringify(result);
    },
  };
}

/** True only for a signal the caller supplied and already aborted. */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/**
 * Registers the WebMCP agent tools when, and only when, all three conditions hold: the browser
 * exposes `document.modelContext`, the `project.snapshot` result carries `exposeAgentTools: true`,
 * and (for the two spend tools) `capabilities.spend` is true. Any condition unmet is a no-op that
 * reports nothing attempted, leaving the dashboard byte-for-byte unchanged. It never gates the
 * server: the same RPCs are reachable with or without this call.
 *
 * An aborted `deps.signal` is a fourth such condition, checked before the snapshot fetch, again
 * after it, and once per loop turn. A caller that has already torn the surface down gets nothing
 * registered at all, rather than a set the host has to take back a tick later, and an abort that
 * lands mid-pass stops the pass where it is instead of registering against a dead signal.
 *
 * Each registration is awaited inside its own try/catch, so a rejection is caught while the failing
 * tool name is still in hand, and a failing tool is collected rather than allowed to abort the
 * tools after it: the surface is worth more partially registered than not at all, and the returned
 * report is what makes both the partial outcome and its cause visible to the caller.
 */
export async function registerAgentTools(
  deps: RegisterAgentToolsDeps,
): Promise<AgentToolsRegistration> {
  const { modelContext, signal } = deps;
  if (modelContext === undefined || isAborted(signal)) {
    return NOTHING_ATTEMPTED;
  }
  const snapshot = await deps.rpcClient.call(PROJECT_SNAPSHOT_METHOD, {});
  if (!snapshot.ok || snapshot.result.exposeAgentTools !== true || isAborted(signal)) {
    return NOTHING_ATTEMPTED;
  }
  const options = signal === undefined ? undefined : { signal };
  const spendGranted = snapshot.result.capabilities.spend;
  const registered: string[] = [];
  const failures: ToolRegistrationFailure[] = [];
  for (const method of RPC_METHOD_NAMES) {
    const descriptor = TOOL_DESCRIPTORS[method];
    if (isAborted(signal)) {
      break;
    }
    if (descriptor.spendGated && !spendGranted) {
      continue;
    }
    const tool = buildTool(method, descriptor, deps);
    try {
      await modelContext.registerTool(tool, options);
      registered.push(tool.name);
    } catch (error) {
      failures.push(toRegistrationFailure(tool.name, error));
    }
  }
  return { attempted: registered.length + failures.length, registered, failures };
}
