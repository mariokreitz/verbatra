import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { RpcCallResult } from "../../client/rpc-client.js";
import { rpcClient } from "../api.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";

type LockStateResponse = RpcCallResult<"lock.state">;
type LockLocaleState = Extract<
  Extract<LockStateResponse, { ok: true }>["result"],
  { exists: true }
>["locales"][number];

type LockPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "no-lock" }
  | {
      readonly kind: "loaded";
      readonly version: number;
      readonly locales: readonly LockLocaleState[];
    };

function LockLocaleRow({ locale }: { readonly locale: LockLocaleState }): ReactNode {
  return (
    <tr>
      <td>{locale.locale}</td>
      <td>{locale.keyCount}</td>
      <td>{locale.missing}</td>
      <td>{locale.stale}</td>
      <td>{locale.upToDate}</td>
    </tr>
  );
}

function LockTable({
  version,
  locales,
}: {
  readonly version: number;
  readonly locales: readonly LockLocaleState[];
}): ReactNode {
  return (
    <div>
      <p>Lock-file present, version {version}.</p>
      <table>
        <thead>
          <tr>
            <th>Locale</th>
            <th>Recorded keys</th>
            <th>Missing</th>
            <th>Stale</th>
            <th>Up to date</th>
          </tr>
        </thead>
        <tbody>
          {locales.map((locale) => (
            <LockLocaleRow key={locale.locale} locale={locale} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Lock-file existence, version, and per-locale drift, from the sdk's read-only `lockState`
 * through `lock.state`. `exists: false` (no lock-file written yet) renders as its own state,
 * distinct from a present but empty lock-file, which renders a table with zero recorded keys.
 */
export function LockPanel(): ReactNode {
  const [state, setState] = useState<LockPanelState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("lock.state", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setState({ kind: "error", message: response.error.message });
        return;
      }
      if (!response.result.exists) {
        setState({ kind: "no-lock" });
        return;
      }
      setState({
        kind: "loaded",
        version: response.result.version,
        locales: response.result.locales,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return <Loading />;
  }
  if (state.kind === "error") {
    return <ErrorMessage message={state.message} />;
  }
  if (state.kind === "no-lock") {
    return <p>No lock-file yet. It is written after the first successful translate run.</p>;
  }
  return <LockTable version={state.version} locales={state.locales} />;
}
