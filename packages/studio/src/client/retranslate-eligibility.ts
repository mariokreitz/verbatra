import type { IntegrityPillView } from "./integrity-pill.js";

/** The two write capabilities relevant to deciding whether a retranslate action can render. */
export interface RetranslateCapabilities {
  readonly spend: boolean;
  readonly writeToDisk: boolean;
}

/**
 * Whether the Retranslate action should render for one locale row: both write capabilities must
 * be granted, and the row's own integrity pill must currently report a failure ("danger" tone,
 * see `deriveIntegrityPillView`). `capabilities` is `undefined` while it has not loaded yet, and
 * `pill` is `null` when the key is not "changed" in this locale (nothing to check); both cases
 * render nothing, matching "absent from the rendered UI, not merely disabled".
 */
export function canRetranslate(
  capabilities: RetranslateCapabilities | undefined,
  pill: IntegrityPillView | null,
): boolean {
  return (
    capabilities?.spend === true &&
    capabilities.writeToDisk &&
    pill !== null &&
    pill.tone === "danger"
  );
}
