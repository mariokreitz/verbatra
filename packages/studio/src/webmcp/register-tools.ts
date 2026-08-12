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
 *
 * The description is the only prose a model ever reads about a tool, so it is a functional surface,
 * not a label. The recorded standard every description here follows, enforced by the tests in
 * `register-tools.test.ts`:
 *
 * 1. At least three sentences, each carrying a fact rather than padding.
 * 2. State what the tool does, when to use it, when not to use it, and any caveat that changes a
 *    decision: cost, mutation, idempotence, reversibility, concurrency, and how an absent or
 *    unavailable result must be read.
 * 3. Name every parameter in the method's params schema, and name nothing else, in backticks.
 *    Backticks are reserved for parameter names so the prose can be checked against the schema in
 *    both directions; a method taking no parameters says so and carries no backticks.
 * 4. Refer to another tool by its advertised, sanitized name (verbatra_status_diff), never by the
 *    dotted rpc method name, since the advertised name is the one an agent can actually call.
 * 5. A spend-gated tool states in its own words that it spends provider budget, that it is not
 *    idempotent, and that it cannot be undone.
 */
const TOOL_DESCRIPTORS: Record<RpcMethodName, ToolDescriptor> = {
  [PROJECT_SNAPSHOT_METHOD]: {
    description:
      "Reads the loaded project configuration: source locale, target locales, file format and pattern, provider id, glossary provenance, and the server capability flags. " +
      "Call it first to learn which locales and provider every other tool acts on, and to see whether the spend capability is granted. " +
      "Do not use it to read translated text, and do not expect it to change between calls: the projection is resolved once when the server starts. " +
      "Takes no parameters, calls no provider, and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [STATUS_CHECK_METHOD]: {
    description:
      "Reports, per target locale, how many keys are missing, stale, or up to date against the source, as counts only. " +
      "Use it for a fast answer to how far a project has drifted before deciding whether any translation work is needed. " +
      "Do not use it when you need the affected key names, which only verbatra_status_diff returns. " +
      "The optional `locales` parameter narrows the report to the named target locales, an omitted `locales` covers every configured target locale, and an explicitly empty array is rejected as invalid params. " +
      "Read-only: it calls no provider and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [STATUS_DIFF_METHOD]: {
    description:
      "Lists, per target locale, the key names that are added, changed, or orphaned relative to the source. " +
      "Use it after verbatra_status_check when you need the actual keys behind the counts, for instance to pick one key to inspect or fix. " +
      "Do not use it as a content view: it returns key names, never translated values, and the lists are uncapped, so a large project returns a large result. " +
      "The optional `locales` parameter narrows the report to the named target locales, an omitted `locales` covers every configured target locale, and an explicitly empty array is rejected as invalid params. " +
      "Read-only: it calls no provider and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [GLOSSARY_GET_METHOD]: {
    description:
      "Reads the project glossary: the configured term mappings plus whether they came from the config file inline, from a separate file, or are absent entirely. " +
      "Use it to learn the terminology a translation is expected to follow before you write or request one. " +
      "Do not look for a way to change it: there is no glossary write tool on this surface. " +
      "Every glossary value passes through secret redaction first, so a value shaped like a provider API key is returned as a placeholder rather than its real text. " +
      "Takes no parameters. Read-only: it calls no provider and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [LOCK_STATE_METHOD]: {
    description:
      "Reads the lock file: whether one exists at all and, when it does, its version and the per locale count of keys that are missing, stale, or up to date against the recorded baseline. " +
      "Use it to tell a project that has never been translated, which has no lock file, from one whose recorded baseline has drifted. " +
      "Do not confuse it with verbatra_status_check, which compares the locale files themselves rather than the recorded lock baseline. " +
      "Takes no parameters. Read-only: it reads the lock and locale files fresh on every call, calls no provider, and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [HISTORY_LIST_METHOD]: {
    description:
      "Lists recent git commits that touched the source locale file or any configured target locale file, each with its hash, author date, subject, and touched paths. " +
      "Use it to see who last changed a locale file and when. " +
      "Do not rely on it outside a git repository: when git is missing or the project root is not a repository the result reports itself as unavailable instead of failing, and file renames are never followed, so history before a rename is not shown. " +
      "The optional `limit` parameter asks for at most that many commits, and the server applies its own cap regardless of what you ask for. " +
      "Read-only: it calls no provider and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [KEY_INTEGRITY_METHOD]: {
    description:
      "Reports, for one key, whether each target locale's current value keeps the source placeholders and stays valid ICU MessageFormat. " +
      "Use it to decide whether a translation is safe to keep, typically right after writing or requesting one. " +
      "Do not read absence as a pass or a failure: a locale appears only while the key counts as changed there, so a locale where the key is missing, orphaned, or already in sync carries no entry at all. " +
      "The required `key` parameter is the source key to inspect, the optional `locales` parameter narrows the check to the named target locales, and an omitted `locales` covers every configured target locale. " +
      "The result carries only the boolean outcomes and the specific placeholder tokens involved, never a full source or target string. " +
      "Read-only: it calls no provider and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [REVIEW_QUEUE_METHOD]: {
    description:
      "Lists the entries the last recorded translation run flagged as needing human review, per locale, with the reason code behind each flag. " +
      "Use it to find the translations most worth a second look before spending anything on them. " +
      "Do not treat an unavailable result as an empty queue: it means no run has ever recorded a status snapshot, or that snapshot is missing, corrupt, or at an unrecognized version. " +
      "Only a real translation run refreshes the snapshot, so an entry corrected through verbatra_translation_editEntry stays listed here until the next run. " +
      "Takes no parameters. Read-only: it calls no provider and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [USAGE_SUMMARY_METHOD]: {
    description:
      "Reads the run wide token usage and budget figures recorded by the last translation run, together with the time that run was recorded. " +
      "Use it to judge what previous work cost before deciding to spend more. " +
      "Do not expect live figures: nothing but a real translation run updates it, and an unavailable result means no run has ever recorded a status snapshot. " +
      "Usage and budget are each present only when the recorded run carried them, and are never defaulted to a fabricated zero. " +
      "Takes no parameters. Read-only: it calls no provider and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: false,
    spendGated: false,
  },
  [KEY_VALUE_METHOD]: {
    description:
      "Reads the current source value and, when it exists, the current target value for exactly one key in exactly one target locale. " +
      "Use it to see the text before changing it, and to confirm afterwards what was written. " +
      "Do not use it for bulk reads: it answers for a single pair per call, and no bulk content tool exists on this surface. " +
      "The required `locale` parameter must be a configured target locale and the required `key` parameter must exist in the source, and an unknown locale or key is answered as an error rather than an empty result. " +
      "An absent target value means the key does not exist in that locale yet, while an empty string is a real stored value. " +
      "Read-only: it reads fresh from disk on every call, calls no provider, and writes nothing.",
    readOnlyHint: true,
    untrustedContentHint: true,
    spendGated: false,
  },
  [EDIT_ENTRY_METHOD]: {
    description:
      "Writes one caller supplied translation for exactly one key in exactly one target locale. " +
      "Use it whenever you already know the correct text, since it spends no provider budget at all. " +
      "Do not use it to obtain a translation: it never calls a provider, so what is written is exactly the text you send. " +
      "The required `locale` parameter must be a configured target locale, the required `key` parameter must exist in the source, and the required `value` parameter is the replacement text, capped at 20000 characters. " +
      "The value is checked for placeholder and ICU integrity before anything is written, so a rejected value is returned with its reason and nothing is written, while an accepted value is written to the target locale file and its lock entry immediately, replacing the previous value with no undo on this surface. " +
      "This tool is always registered: local editing needs no capability flag and is never gated behind the spend flag.",
    readOnlyHint: false,
    untrustedContentHint: true,
    spendGated: false,
  },
  [RETRANSLATE_ENTRY_METHOD]: {
    description:
      "Spends provider budget on every call: asks the configured provider for a fresh translation of exactly one key in exactly one target locale, then writes it to the target locale file and its lock entry if it passes the placeholder and ICU integrity check. " +
      "Use it only when a translation is genuinely wrong or missing and you have no correct text of your own, because verbatra_translation_editEntry writes a known value for free. " +
      "Do not call it to preview or to retry blindly: the provider is billed before the integrity check runs, so a rejected result still costs money while writing nothing, and the call is not idempotent, since every call is billed again and can return different text. " +
      "The write cannot be undone through this surface: the previous value is replaced, and only verbatra_translation_editEntry can restore it, and only if you read it with verbatra_key_value first. " +
      "The required `locale` parameter must be a configured target locale and the required `key` parameter must exist in the source. " +
      "It is registered only when the server was started with the spend capability granted.",
    readOnlyHint: false,
    untrustedContentHint: true,
    spendGated: true,
  },
  [TRANSLATE_PENDING_METHOD]: {
    description:
      "Spends provider budget on every call, potentially a lot of it: translates every pending key across every configured target locale in one whole project run, the same work the verbatra translate command does, and writes the results to the locale files and the lock file. " +
      "Use it only to bring a whole project current when many keys are pending and the cost is acceptable. " +
      "Do not use it for a single key, where verbatra_translation_retranslateEntry is far cheaper, and do not retry it as though it were free: the call is not idempotent, since a second run bills again for whatever is still pending and can return different text. " +
      "The writes cannot be undone through this surface, and the run is not all or nothing, so a run that fails partway can leave some locales already written and others untouched. " +
      "It takes no parameters, because source drift can affect every target locale at once, and only one run may be in flight at a time, so a second concurrent call is refused rather than queued. " +
      "It is registered only when the server was started with the spend capability granted.",
    readOnlyHint: false,
    untrustedContentHint: true,
    spendGated: true,
  },
};

/**
 * Maps an RPC method name to its advertised tool name: the shared `verbatra_` prefix namespaces the
 * tools, and the dot in each method name is replaced with an underscore.
 *
 * The current WebMCP specification allows a tool name of 1 to 128 characters over ASCII
 * alphanumerics, underscore, hyphen, and U+002E FULL STOP, so the dot would be valid and the
 * replacement is not required for validity. It is retained for name stability: the advertised names
 * are already in use, and an agent that knows one must not have it renamed under it. Every generated
 * name is well within both that rule and the stricter `^[a-zA-Z0-9_-]{1,64}$` charset an MCP
 * tool-use pipeline may additionally impose, and the mapping stays collision-free over the fixed
 * thirteen-method set. The raw method name is still what every `rpcClient.call` uses; only the
 * advertised tool name is sanitized.
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
