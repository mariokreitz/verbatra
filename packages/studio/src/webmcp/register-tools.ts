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

/** The minimal `document.modelContext` surface this adapter needs: register one tool at a time. */
export interface ModelContext {
  registerTool(tool: WebMcpTool): void;
}

/** Everything {@link registerAgentTools} needs, injected by the app so the module stays DOM-free. */
export interface RegisterAgentToolsDeps {
  /** The browser WebMCP surface, or `undefined` in a browser without WebMCP support. */
  readonly modelContext: ModelContext | undefined;
  /** The shared rpc client every tool delegates through. */
  readonly rpcClient: RpcClient;
  /** The single source of truth for each method's params schema, injected for testability. */
  readonly schemas: typeof rpcParamsSchemas;
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
    name: method,
    description: descriptor.description,
    inputSchema: z.toJSONSchema(deps.schemas[method]),
    annotations: buildAnnotations(descriptor),
    execute: async (input: unknown): Promise<string> => {
      const result = await deps.rpcClient.call(method, input as RpcParamsFor<M>);
      return JSON.stringify(result);
    },
  };
}

/**
 * Registers the WebMCP agent tools when, and only when, all three conditions hold: the browser
 * exposes `document.modelContext`, the `project.snapshot` result carries `exposeAgentTools: true`,
 * and (for the two spend tools) `capabilities.spend` is true. Any condition unmet is a silent
 * no-op, leaving the dashboard byte-for-byte unchanged. It never gates the server: the same RPCs
 * are reachable with or without this call.
 */
export async function registerAgentTools(deps: RegisterAgentToolsDeps): Promise<void> {
  const { modelContext } = deps;
  if (modelContext === undefined) {
    return;
  }
  const snapshot = await deps.rpcClient.call(PROJECT_SNAPSHOT_METHOD, {});
  if (!snapshot.ok || snapshot.result.exposeAgentTools !== true) {
    return;
  }
  const spendGranted = snapshot.result.capabilities.spend;
  for (const method of RPC_METHOD_NAMES) {
    const descriptor = TOOL_DESCRIPTORS[method];
    if (descriptor.spendGated && !spendGranted) {
      continue;
    }
    modelContext.registerTool(buildTool(method, descriptor, deps));
  }
}
