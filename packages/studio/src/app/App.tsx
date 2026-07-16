import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  handleRefreshEvent,
  nextToastSlot,
  type RefreshToastView,
} from "../client/refresh-toast.js";
import { visibleReviewQueueRows } from "../client/review-queue-data.js";
import { PAGE_IDS, type PageId, pageHash, parsePageHash } from "../client/routes.js";
import { refreshBus, reviewOverlayStore, sessionStore } from "./api.js";
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
import { useReviewOverlaySignal } from "./use-review-overlay-signal.js";
import { useReviewQueue } from "./use-review-queue.js";

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

  function handleToggleSidebar(): void {
    setSidebarCollapsed((current) => {
      storeSidebarCollapsed(!current);
      return !current;
    });
  }

  function handleDismissToast(): void {
    setToast((current) => nextToastSlot(current, { kind: "dismiss" }));
  }

  if (sessionExpired) {
    return <SessionExpiredNotice />;
  }

  return (
    <AppShell
      page={page}
      onNavigate={setPage}
      refreshToken={refreshToken}
      toast={toast}
      onDismissToast={handleDismissToast}
      mobileNavOpen={mobileNavOpen}
      onSetMobileNavOpen={setMobileNavOpen}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={handleToggleSidebar}
    />
  );
}

/**
 * The rendered shell, split from `App` so its hooks (most notably the review-queue read backing
 * the nav count) never run while the session-expired notice is up: `App` returns before
 * rendering this, and hooks in an unrendered child simply do not execute.
 */
function AppShell({
  page,
  onNavigate,
  refreshToken,
  toast,
  onDismissToast,
  mobileNavOpen,
  onSetMobileNavOpen,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  readonly page: PageId;
  readonly onNavigate: (page: PageId) => void;
  readonly refreshToken: number;
  readonly toast: RefreshToastView | undefined;
  readonly onDismissToast: () => void;
  readonly mobileNavOpen: boolean;
  readonly onSetMobileNavOpen: (open: boolean) => void;
  readonly sidebarCollapsed: boolean;
  readonly onToggleSidebar: () => void;
}): ReactNode {
  // The review queue's visible size, shown as a count chip on the Review nav entry. Reuses the
  // Review panel's own data path end to end: the same refresh-reactive fetch and the same
  // session overlay, re-read on every overlay change (an approve, reject, or accepted edit
  // updates the chip instantly, without waiting for the next live-refresh event).
  const reviewQueue = useReviewQueue(refreshToken);
  useReviewOverlaySignal();
  const reviewCount =
    reviewQueue.kind === "data"
      ? visibleReviewQueueRows(reviewQueue.data, reviewOverlayStore).length
      : 0;
  const pageBadges: Readonly<Partial<Record<PageId, number>>> = { review: reviewCount };

  const ActivePanel = PAGE_PANELS[page];

  function navigate(next: PageId): void {
    window.location.hash = pageHash(next);
    onNavigate(next);
    onSetMobileNavOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <DesktopSidebar
        workPages={WORK_PAGES}
        referencePages={REFERENCE_PAGES}
        pageLabels={PAGE_LABELS}
        pageIcons={PAGE_ICONS}
        pageBadges={pageBadges}
        activePage={page}
        onSelectPage={navigate}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={onToggleSidebar}
      />
      {mobileNavOpen ? (
        <MobileNavDrawer
          workPages={WORK_PAGES}
          referencePages={REFERENCE_PAGES}
          pageLabels={PAGE_LABELS}
          pageIcons={PAGE_ICONS}
          pageBadges={pageBadges}
          activePage={page}
          onSelectPage={navigate}
          onClose={() => onSetMobileNavOpen(false)}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pageLabel={PAGE_LABELS[page]} onOpenNav={() => onSetMobileNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Container>
            <ActivePanel refreshToken={refreshToken} />
          </Container>
        </main>
      </div>
      {toast !== undefined ? <RefreshToast view={toast} onDismiss={onDismissToast} /> : null}
    </div>
  );
}
