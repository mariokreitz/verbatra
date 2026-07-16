import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { connectionStore } from "./api.js";
import { Badge } from "./Badge.js";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";
import { ThemeSwitcher } from "./ThemeSwitcher.js";
import { microLabelClassName } from "./ui.js";

/**
 * The live-refresh state, surfaced only while it is degraded: the healthy case is this
 * dashboard's baseline (a page you can see at all is being served by a live local process), so
 * a permanent "Live" badge carries no information. While the stream is down the amber badge
 * appears; the moment it recovers the chrome goes quiet again. The wrapping `role=status` stays
 * mounted so both transitions announce to assistive technology.
 */
function LiveIndicator(): ReactNode {
  const [status, setStatus] = useState(connectionStore.getStatus());
  useEffect(() => {
    const unsubscribe = connectionStore.subscribe(setStatus);
    // The stream opens from module scope (api.ts), so a transition can land between this
    // component's first render and this subscription; re-read once after subscribing or that
    // transition is missed and the badge reports a stale state for the whole session.
    setStatus(connectionStore.getStatus());
    return unsubscribe;
  }, []);

  return (
    <span role="status">
      {status === "live" ? null : <Badge tone="warning">Reconnecting</Badge>}
    </span>
  );
}

export interface TopBarProps {
  /** The active page's label, the bar's orientation text. Not a heading; the h1 belongs to each
   * page's `PageHeader`. */
  readonly pageLabel: string;
  /** Opens the mobile nav drawer; the trigger only renders below the md breakpoint. */
  readonly onOpenNav: () => void;
}

/**
 * The application's fixed header row, always visible while the content column scrolls under it:
 * orientation on the start side (the mobile menu button and the current page's name as a
 * monospace context line; the nav is flat, so there is no deeper trail to spell out), the
 * live-updates indicator and the theme switcher on the end side. Sits on the card surface so
 * the chrome reads as one plane with the rail.
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
