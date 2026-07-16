import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { connectionStore } from "./api.js";
import { Badge } from "./Badge.js";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";
import { ThemeSwitcher } from "./ThemeSwitcher.js";
import { microLabelClassName } from "./ui.js";

/**
 * The live-refresh state, always visible: this dashboard's whole model is "watch the project
 * and stay current", so whether the stream is up is first-class chrome, not a hidden detail.
 * Green while the SSE connection streams; amber while it reconnects with backoff. `role=status`
 * announces the transition to assistive technology.
 */
function LiveIndicator(): ReactNode {
  const [status, setStatus] = useState(connectionStore.getStatus());
  useEffect(() => connectionStore.subscribe(setStatus), []);

  const live = status === "live";
  return (
    <span role="status">
      <Badge tone={live ? "success" : "warning"}>{live ? "Live" : "Reconnecting"}</Badge>
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
