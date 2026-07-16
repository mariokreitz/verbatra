import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { isPaletteShortcut } from "../client/command-palette.js";
import {
  handleRefreshEvent,
  nextToastSlot,
  type RefreshToastView,
} from "../client/refresh-toast.js";
import { refreshBus, sessionStore } from "./api.js";
import { Breadcrumbs } from "./Breadcrumbs.js";
import { CommandPalette } from "./CommandPalette.js";
import type { PanelProps } from "./panel-props.js";
import { DiffPanel } from "./panels/DiffPanel.js";
import { HistoryPanel } from "./panels/HistoryPanel.js";
import { LockPanel } from "./panels/LockPanel.js";
import { OverviewPanel } from "./panels/OverviewPanel.js";
import { ReviewPanel } from "./panels/ReviewPanel.js";
import { StatusPanel } from "./panels/StatusPanel.js";
import { UsagePanel } from "./panels/UsagePanel.js";
import { RefreshToast } from "./RefreshToast.js";
import { DesktopSidebar, MobileNavDrawer, MobileTopBar, type NavGroup } from "./Sidebar.js";

const TABS = ["overview", "status", "diff", "review", "usage", "lock", "history"] as const;

type Tab = (typeof TABS)[number];

const TAB_LABELS: Readonly<Record<Tab, string>> = {
  overview: "Overview",
  status: "Status",
  diff: "Diff",
  review: "Review",
  usage: "Usage",
  lock: "Lock",
  history: "History",
};

// The sidebar's information architecture: Project (the read-only config/glossary snapshot),
// Translations (the three panels a translator or reviewer actually works in day to day), and
// Operations (drift/budget/audit views someone checks less often, not while translating). Every
// value in TABS appears in exactly one group, so this is a presentation grouping over the same
// flat tab set TAB_PANELS and the command palette already use, not a second source of truth for
// which tabs exist.
const NAV_GROUPS: readonly NavGroup<Tab>[] = [
  { label: "Project", tabs: ["overview"] },
  { label: "Translations", tabs: ["status", "diff", "review"] },
  { label: "Operations", tabs: ["usage", "lock", "history"] },
];

// NAV_GROUPS's exhaustiveness over TABS gets none of the free compile-time checking
// Readonly<Record<Tab, ...>> already gives TAB_LABELS/TAB_PANELS: a tab added to TABS but forgotten
// here would silently vanish from both the desktop sidebar and the mobile drawer (still reachable
// through the command palette) with nothing failing at build, lint, or test time, since src/app/**
// has no test harness. This runtime assertion, evaluated once at module load, is the cheap
// substitute for that missing static check.
const GROUPED_TABS = new Set(NAV_GROUPS.flatMap((group) => group.tabs));
if (GROUPED_TABS.size !== TABS.length || TABS.some((candidate) => !GROUPED_TABS.has(candidate))) {
  throw new Error("NAV_GROUPS must partition TABS exactly, with no tab missing or duplicated");
}

/** The nav group a tab belongs to, for the breadcrumb trail. Falls back to the tab's own label in
 * the impossible case a tab isn't in any group (the assertion above already rules this out; the
 * fallback exists only so this stays a total function without a second unreachable-state throw). */
function groupLabelForTab(tabId: Tab): string {
  return NAV_GROUPS.find((group) => group.tabs.includes(tabId))?.label ?? TAB_LABELS[tabId];
}

// Every panel receives refreshToken. StatusPanel reacts to it directly (through the covered
// client/state.ts reducer); DiffPanel passes it straight through to an open KeyDetailDrawer,
// which re-fetches its own key.integrity view on change. ReviewPanel and UsagePanel react to it
// the same way StatusPanel does, re-fetching review.queue/usage.summary on every live-refresh
// event. The remaining panels ignore the prop for now, a deliberate, incremental scope choice
// rather than an oversight. The refresh toast below is a second, independent reaction to the
// same live-refresh event.
const TAB_PANELS: Readonly<Record<Tab, (props: PanelProps) => ReactNode>> = {
  overview: OverviewPanel,
  status: StatusPanel,
  diff: DiffPanel,
  review: ReviewPanel,
  usage: UsagePanel,
  lock: LockPanel,
  history: HistoryPanel,
};

/**
 * The terminal, full-screen notice shown once the session is marked expired (G22): it never
 * clears itself and nothing in this component polls or retries; the only way out is a full page
 * reload from the loopback URL printed in the terminal.
 */
function SessionExpiredNotice(): ReactNode {
  return (
    <div className="flex h-screen items-center justify-center p-6 text-center" role="alert">
      <div className="max-w-md">
        <h1 className="mb-3 text-xl font-semibold text-foreground">Session expired</h1>
        <p className="text-muted-foreground">
          Restart Verbatra Studio and open the URL printed in the terminal again.
        </p>
      </div>
    </div>
  );
}

function isSessionExpired(): boolean {
  return sessionStore.getState().kind === "session-expired";
}

export function App(): ReactNode {
  const [tab, setTab] = useState<Tab>("overview");
  const [sessionExpired, setSessionExpired] = useState(isSessionExpired());
  // Bumped once per live-refresh event (source, targets, or lock changed); passed to the active
  // panel so it can re-fetch. The event's own reason and timestamp are not needed here: every
  // panel re-fetches its own view wholesale rather than branching on which category changed.
  const [refreshToken, setRefreshToken] = useState(0);
  // One toast slot (client/refresh-toast.ts's own one-slot rule): a new refresh event always
  // replaces whatever is shown, including clearing it entirely for an event with nothing to
  // report; a dismiss always clears it without ever calling the translate-pending action.
  const [toast, setToast] = useState<RefreshToastView | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(
    () => sessionStore.subscribe((state) => setSessionExpired(state.kind === "session-expired")),
    [],
  );
  useEffect(
    () =>
      refreshBus.subscribe((event) => {
        const handled = handleRefreshEvent(event);
        if (handled.bumpToken) {
          setRefreshToken((token) => token + 1);
        }
        setToast(handled.toast);
      }),
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isPaletteShortcut(event)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (sessionExpired) {
    return <SessionExpiredNotice />;
  }

  const ActivePanel = TAB_PANELS[tab];

  // The palette only ever resolves a selection to one of `TABS`'s own values (see
  // `buildPaletteCommands`, which builds every tab command from this same list), so this cast is
  // sound even though the palette's own types stay generic over `string`, independent of App's Tab
  // union (client modules do not depend on app-layer types).
  function handleSelectTab(nextTab: string): void {
    setTab(nextTab as Tab);
  }

  function handleSelectTabFromSidebar(nextTab: Tab): void {
    setTab(nextTab);
    setMobileNavOpen(false);
  }

  function handleDismissToast(): void {
    setToast((current) => nextToastSlot(current, { kind: "dismiss" }));
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <MobileTopBar title={TAB_LABELS[tab]} onOpenNav={() => setMobileNavOpen(true)} />
      <DesktopSidebar
        groups={NAV_GROUPS}
        tabLabels={TAB_LABELS}
        activeTab={tab}
        onSelectTab={handleSelectTabFromSidebar}
        onOpenSearch={() => setPaletteOpen(true)}
      />
      {mobileNavOpen ? (
        <MobileNavDrawer
          groups={NAV_GROUPS}
          tabLabels={TAB_LABELS}
          activeTab={tab}
          onSelectTab={handleSelectTabFromSidebar}
          onOpenSearch={() => setPaletteOpen(true)}
          onClose={() => setMobileNavOpen(false)}
        />
      ) : null}
      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-auto px-4 py-4 md:px-8 md:py-6">
        <div className="max-w-7xl">
          <div className="sticky top-0 z-[5] mb-6 hidden bg-background pb-2 md:block">
            <Breadcrumbs items={[{ label: groupLabelForTab(tab) }, { label: TAB_LABELS[tab] }]} />
            <h1 className="text-xl font-semibold text-foreground">{TAB_LABELS[tab]}</h1>
          </div>
          <ActivePanel refreshToken={refreshToken} />
        </div>
      </main>
      {paletteOpen ? (
        <CommandPalette
          tabs={TABS.map((id) => ({ tab: id, label: TAB_LABELS[id] }))}
          onSelectTab={handleSelectTab}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
      {toast !== undefined ? <RefreshToast view={toast} onDismiss={handleDismissToast} /> : null}
    </div>
  );
}
