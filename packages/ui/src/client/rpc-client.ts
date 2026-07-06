import type { RpcMethodName, RpcParamsFor, RpcResultFor } from "../shared/rpc/contract.js";
import type { SessionStore } from "./state.js";

/** The minimal response shape the rpc client needs; avoids depending on the DOM lib's `Response` type. */
export interface FetchResponseLike {
  readonly status: number;
  json(): Promise<unknown>;
}

/** What a POST /rpc call needs from `fetch`; injected so this module never touches the DOM global. */
export interface RequestInitLike {
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type FetchLike = (url: string, init: RequestInitLike) => Promise<FetchResponseLike>;

/** One RPC call's outcome: the envelope the server sends, or a client-side session-expired stand-in. */
export type RpcCallResult<M extends RpcMethodName> =
  | { readonly ok: true; readonly result: RpcResultFor<M> }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export interface RpcClientOptions {
  /** The injected fetch implementation; production wraps the browser global, tests inject a stub. */
  readonly fetchImpl: FetchLike;
  /** The shared session store this client reports a 401 to. */
  readonly session: SessionStore;
  /** The RPC endpoint path. Defaults to "/rpc". */
  readonly endpoint?: string;
}

export interface RpcClient {
  call<M extends RpcMethodName>(method: M, params: RpcParamsFor<M>): Promise<RpcCallResult<M>>;
}

const SESSION_EXPIRED_ERROR = {
  code: "SESSION_EXPIRED",
  message: "The session has expired. Reload the page to start a new one.",
} as const;

function isEnvelopeShaped(value: unknown): value is { readonly ok: boolean } {
  return typeof value === "object" && value !== null && "ok" in value;
}

/**
 * The typed, envelope-aware RPC client. On an HTTP 401 it treats the session as permanently
 * expired (G22): it marks the shared session store and returns a session-expired result without
 * ever having read the response body; every later call short-circuits before touching
 * `fetchImpl` again, until a full page reload replaces this client. It never reads or writes the
 * session cookie itself.
 */
export function createRpcClient(options: RpcClientOptions): RpcClient {
  const endpoint = options.endpoint ?? "/rpc";

  async function call<M extends RpcMethodName>(
    method: M,
    params: RpcParamsFor<M>,
  ): Promise<RpcCallResult<M>> {
    if (options.session.getState().kind === "session-expired") {
      return { ok: false, error: SESSION_EXPIRED_ERROR };
    }

    const response = await options.fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params }),
    });

    if (response.status === 401) {
      options.session.markSessionExpired();
      return { ok: false, error: SESSION_EXPIRED_ERROR };
    }

    const payload: unknown = await response.json();
    if (!isEnvelopeShaped(payload)) {
      return {
        ok: false,
        error: { code: "REQUEST_INVALID", message: "The server returned an unexpected response." },
      };
    }
    return payload as RpcCallResult<M>;
  }

  return { call };
}
