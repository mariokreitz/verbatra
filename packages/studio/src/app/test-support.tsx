/**
 * Test-only scaffolding for the React layer: a DOM render helper, small interaction utilities,
 * and a stand-in for `./api.js` that keeps the module-scope browser wiring out of the test run.
 *
 * Every consumer runs under jsdom, declared per file with a `// @vitest-environment jsdom`
 * docblock. This module is excluded from coverage (see `vitest.config.ts`): it never ships, and
 * measuring it would count the scaffolding rather than the components it renders.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach } from "vitest";
import type { ConnectionStatus } from "../client/reconnect.js";
import type { ReviewOverlayStore } from "../client/review-overlay.js";
import { createReviewOverlayStore } from "../client/review-overlay.js";
import type { RpcClient } from "../client/rpc-client.js";
import type { SessionStore } from "../client/state.js";
import { createSessionStore } from "../client/state.js";
import type { RefreshEvent } from "../shared/sse-events.js";
import type { AgentToolsStatusStore } from "../webmcp/registration-store.js";
import { createAgentToolsStatusStore } from "../webmcp/registration-store.js";

// React refuses to run `act` unless the environment declares itself an act environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Mounted {
  readonly container: HTMLDivElement;
  readonly root: Root;
}

const mounted: Mounted[] = [];

/** One mounted tree, plus the queries and lifecycle a test drives it through. */
export interface RenderResult {
  /** The element the tree is mounted into. */
  readonly container: HTMLDivElement;
  /** Renders a new tree into the same root, so state and effects survive. */
  rerender(node: ReactNode): void;
  /** Unmounts early, for asserting effect cleanup. Idempotent with the automatic teardown. */
  unmount(): void;
  /** The first match, or `null` when nothing matches. */
  query(selector: string): HTMLElement | null;
  /** The first match; throws with the selector when nothing matches, so a stale test fails loudly. */
  get(selector: string): HTMLElement;
  /** Every match, in document order. */
  all(selector: string): HTMLElement[];
  /** The first element whose trimmed text equals `text`; throws when there is none. */
  getByText(selector: string, text: string): HTMLElement;
  /** The rendered text content of the whole tree. */
  text(): string;
}

function makeResult(container: HTMLDivElement, root: Root): RenderResult {
  return {
    container,
    rerender(node: ReactNode): void {
      act(() => {
        root.render(node);
      });
    },
    unmount(): void {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    query: (selector: string): HTMLElement | null => container.querySelector(selector),
    get(selector: string): HTMLElement {
      const element = container.querySelector<HTMLElement>(selector);
      if (element === null) {
        throw new Error(`no element matched ${selector} in: ${container.innerHTML}`);
      }
      return element;
    },
    all: (selector: string): HTMLElement[] => [
      ...container.querySelectorAll<HTMLElement>(selector),
    ],
    getByText(selector: string, text: string): HTMLElement {
      const match = [...container.querySelectorAll<HTMLElement>(selector)].find(
        (element) => element.textContent?.trim() === text,
      );
      if (match === undefined) {
        throw new Error(`no ${selector} had the text ${JSON.stringify(text)}`);
      }
      return match;
    },
    text: (): string => container.textContent ?? "",
  };
}

/**
 * Mounts `node` into a fresh container attached to the document, synchronously. Use
 * {@link renderAsync} when the component resolves a promise (any rpc-backed hook) during mount.
 */
export function render(node: ReactNode): RenderResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  act(() => {
    root.render(node);
  });
  return makeResult(container, root);
}

/** Mounts `node` and lets the microtask queue drain, so promise-resolving effects have settled. */
export async function renderAsync(node: ReactNode): Promise<RenderResult> {
  const result = render(node);
  await flush();
  return result;
}

/** Drains pending promises and the React work they schedule. */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Clicks an element inside `act`, so the resulting state update is applied before returning. */
export function click(element: Element): void {
  act(() => {
    (element as HTMLElement).click();
  });
}

/** Clicks an element and then drains the promises the handler started. */
export async function clickAsync(element: Element): Promise<void> {
  click(element);
  await flush();
}

/** Dispatches a keydown on the document, for the Escape and Tab handling dialogs install there. */
export function pressKey(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
}

function setNativeValue(element: HTMLElement, prototype: object, value: string): void {
  // React tracks the last value it wrote on the node, so a plain assignment is seen as "no change"
  // and the input event is dropped. Going through the prototype setter updates the node without
  // touching the tracker, which is what makes React accept the event.
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
}

/** Types `value` into a text input or textarea, the way a change handler sees a real edit. */
export function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    setNativeValue(element, prototype, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Picks an option in a native select, the way a change handler sees a real selection. */
export function selectOption(element: HTMLSelectElement, value: string): void {
  act(() => {
    setNativeValue(element, HTMLSelectElement.prototype, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** A successful or failed rpc envelope, in the shape `RpcClient.call` resolves to. */
export type StubRpcResult =
  | { readonly ok: true; readonly result: unknown }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Answers one rpc call. Returning a promise lets a test hold a call open. */
export type StubRpcHandler = (params: unknown) => StubRpcResult | Promise<StubRpcResult>;

/** One recorded rpc call, for asserting what a component asked the server for. */
export interface RecordedRpcCall {
  readonly method: string;
  readonly params: unknown;
}

const handlers = new Map<string, StubRpcHandler>();

/** Every rpc call the mounted tree has made since the last test, in order. */
export const rpcCalls: RecordedRpcCall[] = [];

/** A failed envelope, the shorthand for the common "the server refused" case. */
export function rpcError(code: string, message = code): StubRpcResult {
  return { ok: false, error: { code, message } };
}

/**
 * Registers what the mocked rpc client answers per method. A result value answers every call to
 * that method; a function is called with the params, so a test can vary the answer or delay it.
 * Methods left unstubbed resolve to a loud `RPC_NOT_STUBBED` error rather than hanging.
 */
export function stubRpc(stubs: Readonly<Record<string, StubRpcResult | StubRpcHandler>>): void {
  for (const [method, stub] of Object.entries(stubs)) {
    handlers.set(method, typeof stub === "function" ? stub : () => stub);
  }
}

async function callRpc(method: string, params: unknown): Promise<StubRpcResult> {
  rpcCalls.push({ method, params });
  const handler = handlers.get(method);
  if (handler === undefined) {
    return rpcError("RPC_NOT_STUBBED", `no stub registered for ${method}`);
  }
  return handler(params);
}

let stores = freshStores();

function freshStores(): {
  session: SessionStore;
  overlay: ReviewOverlayStore;
  agentTools: AgentToolsStatusStore;
} {
  return {
    session: createSessionStore(),
    overlay: createReviewOverlayStore(),
    agentTools: createAgentToolsStatusStore(),
  };
}

/**
 * The stores are the real implementations from `src/client` and `src/webmcp`, not fakes, so a test
 * exercises the same state machine the browser does. They are reached through these stable
 * delegates because the mocked module object is built once per file while the backing instances
 * are replaced between tests.
 */
export const sessionStore: SessionStore = {
  getState: () => stores.session.getState(),
  markSessionExpired: () => stores.session.markSessionExpired(),
  subscribe: (listener) => stores.session.subscribe(listener),
};

/** The review "actioned this session" overlay, reset between tests. */
export const reviewOverlayStore: ReviewOverlayStore = {
  isActioned: (entry) => stores.overlay.isActioned(entry),
  markActioned: (entry) => stores.overlay.markActioned(entry),
  subscribe: (listener) => stores.overlay.subscribe(listener),
};

/** The agent-tools registration outcome store, reset between tests. */
export const agentToolsStatusStore: AgentToolsStatusStore = {
  getFailures: () => stores.agentTools.getFailures(),
  publish: (failures) => stores.agentTools.publish(failures),
  subscribe: (listener) => stores.agentTools.subscribe(listener),
};

const refreshListeners = new Set<(event: RefreshEvent) => void>();

/** The live-refresh bus stand-in; {@link emitRefresh} plays the server's push events into it. */
export const refreshBus = {
  subscribe(listener: (event: RefreshEvent) => void): () => void {
    refreshListeners.add(listener);
    return () => {
      refreshListeners.delete(listener);
    };
  },
};

/** Delivers one live-refresh event to every subscriber, inside `act`. */
export function emitRefresh(event: RefreshEvent): void {
  act(() => {
    for (const listener of [...refreshListeners]) {
      listener(event);
    }
  });
}

const connectionListeners = new Set<(status: ConnectionStatus) => void>();
let connectionStatus: ConnectionStatus = "live";

/** The live-connection status store stand-in; {@link setConnectionStatus} drives it. */
export const connectionStore = {
  getStatus: (): ConnectionStatus => connectionStatus,
  subscribe(listener: (status: ConnectionStatus) => void): () => void {
    connectionListeners.add(listener);
    return () => {
      connectionListeners.delete(listener);
    };
  },
};

/** Publishes a connection status, inside `act`, the way the reconnect controller would. */
export function setConnectionStatus(status: ConnectionStatus): void {
  connectionStatus = status;
  act(() => {
    for (const listener of [...connectionListeners]) {
      listener(status);
    }
  });
}

/** The shape of `./api.js`, as far as the React layer uses it. */
export interface AppApiModule {
  readonly rpcClient: RpcClient;
  readonly sessionStore: SessionStore;
  readonly reviewOverlayStore: ReviewOverlayStore;
  readonly agentToolsStatusStore: AgentToolsStatusStore;
  readonly refreshBus: typeof refreshBus;
  readonly connectionStore: typeof connectionStore;
}

/**
 * The replacement every app test installs with
 * `vi.mock("./api.js", () => import("./test-support.js").then((m) => m.apiMock()))`.
 *
 * The real `api.ts` opens an `EventSource` at module scope, which jsdom does not implement, so
 * importing it under test would throw before a single component rendered. The cast is the one
 * concession: `call` is answered per method by {@link stubRpc} rather than by the per-method
 * generic the real client is typed with.
 */
export function apiMock(): AppApiModule {
  return {
    rpcClient: { call: callRpc } as unknown as RpcClient,
    sessionStore,
    reviewOverlayStore,
    agentToolsStatusStore,
    refreshBus,
    connectionStore,
  };
}

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    act(() => {
      entry.root.unmount();
    });
    entry.container.remove();
  }
  handlers.clear();
  rpcCalls.length = 0;
  refreshListeners.clear();
  connectionListeners.clear();
  connectionStatus = "live";
  stores = freshStores();
});
