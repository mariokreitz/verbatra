import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  handleRefreshEvent,
  nextToastSlot,
  type RefreshToastView,
} from "../client/refresh-toast.js";
import { PAGE_IDS, type PageId, pageHash, parsePageHash } from "../client/routes.js";
import { refreshBus, sessionStore } from "./api.js";
import type { IconName } from "./Icon.js";
import { readStoredSidebarCollapsed, storeSidebarCollapsed } from "./lib/sidebar-dom.js";
import type { PanelProps } from "./panel-props.js";
import { ActivityPanel } from "./panels/ActivityPanel.js";
import { ReviewPanel } from "./panels/ReviewPanel.js";
import { SettingsPanel } from "./panels/SettingsPanel.js";
import { TranslationsPanel } from "./panels/TranslationsPanel.js";
import { RefreshToast } from "./RefreshToast.js";
import { DesktopSidebar, MobileNavDrawer } from "./Sidebar.js";
import { TopBar } from "./TopBar.js";
import { Container } from "./ui.js";

const PAGE_LABELS: Readonly<Record<PageId, string>> = {
  translations: "Translations",
  review: "Review",
  activity: "Activity",
  settings: "Settings",
};

/** One glyph per page for the nav rail; the Record type keeps this exhaustive at compile time. */
const PAGE_ICONS: Readonly<Record<PageId, IconName>> = {
  translations: "diff",
  review: "review",
  activity: "activity",
  settings: "settings",
};

// The two sidebar zones ARE the information architecture: the surfaces someone works in daily
// at the top, the surfaces someone checks occasionally at the bottom, next to the collapse
// toggle. No group headers; with four flat pages the placement carries the taxonomy.
const WORK_PAGES: readonly PageId[] = ["translations", "review"];
const REFERENCE_PAGES: readonly PageId[] = ["activity", "settings"];

// The zones must partition PAGE_IDS exactly; a page missing here would silently vanish from
// both the rail and the drawer (still reachable through the URL hash) with nothing failing at
// build or test time, since src/app/** has no test harness.
const ZONED_PAGES = new Set([...WORK_PAGES, ...REFERENCE_PAGES]);
if (ZONED_PAGES.size !== PAGE_IDS.length || PAGE_IDS.some((page) => !ZONED_PAGES.has(page))) {
  throw new Error("WORK_PAGES and REFERENCE_PAGES must partition PAGE_IDS exactly");
}

// Every page receives refreshToken (bumped once per live-refresh event) and re-fetches its
// views on it: coverage, key diff, lock, review queue, usage, and history are all live. The
// refresh toast below is a second, independent reaction to the same live-refresh event.
const PAGE_PANELS: Readonly<Record<PageId, (props: PanelProps) => ReactNode>> = {
  translations: TranslationsPanel,
  review: ReviewPanel,
  activity: ActivityPanel,
  settings: SettingsPanel,
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
  // The URL hash is the source of truth for the current page: parsed once on mount (a reload
  // lands back on the same page) and re-parsed on every hashchange (browser back/forward work).
  // navigate() writes the hash and mirrors the state immediately; the listener firing after is
  // idempotent.
  const [page, setPage] = useState<PageId>(() => parsePageHash(window.location.hash));
  const [sessionExpired, setSessionExpired] = useState(isSessionExpired());
  // One toast slot (client/refresh-toast.ts's own one-slot rule): a new refresh event always
  // replaces whatever is shown, including clearing it entirely for an event with nothing to
  // report; a dismiss always clears it without ever calling the translate-pending action.
  const [toast, setToast] = useState<RefreshToastView | undefined>(undefined);
  const [refreshToken, setRefreshToken] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredSidebarCollapsed);

  useEffect(() => {
    function onHashChange(): void {
      setPage(parsePageHash(window.location.hash));
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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

  if (sessionExpired) {
    return <SessionExpiredNotice />;
  }

  const ActivePanel = PAGE_PANELS[page];

  function navigate(next: PageId): void {
    window.location.hash = pageHash(next);
    setPage(next);
    setMobileNavOpen(false);
  }

  function handleToggleSidebar(): void {
    setSidebarCollapsed((current) => {
      storeSidebarCollapsed(!current);
      return !current;
    });
  }

  function handleDismissToast(): void {
    setToast((current) => nextToastSlot(current, { kind: "dismiss" }));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <DesktopSidebar
        workPages={WORK_PAGES}
        referencePages={REFERENCE_PAGES}
        pageLabels={PAGE_LABELS}
        pageIcons={PAGE_ICONS}
        activePage={page}
        onSelectPage={navigate}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={handleToggleSidebar}
      />
      {mobileNavOpen ? (
        <MobileNavDrawer
          workPages={WORK_PAGES}
          referencePages={REFERENCE_PAGES}
          pageLabels={PAGE_LABELS}
          pageIcons={PAGE_ICONS}
          activePage={page}
          onSelectPage={navigate}
          onClose={() => setMobileNavOpen(false)}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pageLabel={PAGE_LABELS[page]} onOpenNav={() => setMobileNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Container>
            <ActivePanel refreshToken={refreshToken} />
          </Container>
        </main>
      </div>
      {toast !== undefined ? <RefreshToast view={toast} onDismiss={handleDismissToast} /> : null}
    </div>
  );
}
