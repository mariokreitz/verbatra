import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { RpcCallResult } from "../../client/rpc-client.js";
import type { StructuredError } from "../../client/state.js";
import { rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { TableSkeleton } from "../Skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../Table.js";
import { EmptyState } from "../ui.js";

type LockStateResponse = RpcCallResult<"lock.state">;
type LockLocaleState = Extract<
  Extract<LockStateResponse, { ok: true }>["result"],
  { exists: true }
>["locales"][number];

type LockPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: StructuredError }
  | { readonly kind: "no-lock" }
  | {
      readonly kind: "loaded";
      readonly version: number;
      readonly locales: readonly LockLocaleState[];
    };

/**
 * Whether a locale's recorded lock entry has drifted from the source, purely derived from the
 * same missing and stale counts already rendered in this row (no additional data is fetched).
 */
function hasDrift(locale: LockLocaleState): boolean {
  return locale.missing > 0 || locale.stale > 0;
}

function LockLocaleRow({ locale }: { readonly locale: LockLocaleState }): ReactNode {
  const drift = hasDrift(locale);
  return (
    <TableRow>
      <TableCell mono>{locale.locale}</TableCell>
      <TableCell>{locale.keyCount}</TableCell>
      <TableCell>{locale.missing}</TableCell>
      <TableCell>{locale.stale}</TableCell>
      <TableCell>{locale.upToDate}</TableCell>
      <TableCell>
        <Badge tone={drift ? "warning" : "success"}>{drift ? "Drift" : "In sync"}</Badge>
      </TableCell>
    </TableRow>
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
      <p className="mb-3 text-sm text-muted-foreground">Lock-file present, version {version}.</p>
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Locale</TableHeaderCell>
            <TableHeaderCell>Recorded keys</TableHeaderCell>
            <TableHeaderCell>Missing</TableHeaderCell>
            <TableHeaderCell>Stale</TableHeaderCell>
            <TableHeaderCell>Up to date</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {locales.map((locale) => (
            <LockLocaleRow key={locale.locale} locale={locale} />
          ))}
        </TableBody>
      </Table>
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
        setState({ kind: "error", error: response.error });
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
    return (
      <div role="status">
        <span className="sr-only">Loading lock state…</span>
        <TableSkeleton />
      </div>
    );
  }
  if (state.kind === "error") {
    return <ErrorMessage error={state.error} />;
  }
  if (state.kind === "no-lock") {
    return (
      <EmptyState>
        No lock-file yet. It is written after the first successful translate run.
      </EmptyState>
    );
  }
  return <LockTable version={state.version} locales={state.locales} />;
}
