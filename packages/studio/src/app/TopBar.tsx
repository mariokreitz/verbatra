import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { connectionStore } from "./api.js";
import { Badge } from "./Badge.js";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";
import { ThemeSwitcher } from "./ThemeSwitcher.js";
import { microLabelClassName } from "./ui.js";

/** How long the stream must stay degraded before the badge appears: long
 * enough to swallow the normal connect handshake on a fresh page load, short
 * enough that a real outage surfaces quickly. */
const DEGRADED_BADGE_DELAY_MS = 1500;

/**
 * The live-refresh state, surfaced only while it is degraded: the healthy
 * case renders nothing. The amber "Reconnecting" badge appears only after the
 * connection has been non-live for {@link DEGRADED_BADGE_DELAY_MS}, and
 * clears the moment the stream recovers. The status is re-read once right
 * after subscribing, since a transition can land between the first render and
 * the subscription. The wrapping `role="status"` stays mounted so transitions
 * announce to assistive technology.
 */
function LiveIndicator(): ReactNode {
  const [status, setStatus] = useState(connectionStore.getStatus());
  const [showDegraded, setShowDegraded] = useState(false);

  useEffect(() => {
    const unsubscribe = connectionStore.subscribe(setStatus);
    setStatus(connectionStore.getStatus());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status === "live") {
      setShowDegraded(false);
      return;
    }
    const timer = window.setTimeout(() => setShowDegraded(true), DEGRADED_BADGE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <span role="status">{showDegraded ? <Badge tone="warning">Reconnecting</Badge> : null}</span>
  );
}

/** Props for {@link TopBar}. */
export interface TopBarProps {
  /** The active page's label, rendered as orientation text, not a heading. */
  readonly pageLabel: string;
  /** Opens the mobile nav drawer; the trigger only renders below the md breakpoint. */
  readonly onOpenNav: () => void;
}

/**
 * The application's header row: the mobile menu button and the current page's
 * label on the start side, the live-updates indicator and the theme switcher
 * on the end side.
 */
export function TopBar({ pageLabel, onOpenNav }: TopBarProps): ReactNode {
  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <Button
        variant="ghost"
        className="p-1.5 md:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Icon name="menu" />
      </Button>
      <span className={microLabelClassName}>{pageLabel}</span>
      <div className="ms-auto flex items-center gap-2">
        <LiveIndicator />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
