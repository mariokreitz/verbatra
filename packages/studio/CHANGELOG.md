# @verbatra/studio

## 0.2.0

### Minor Changes

- 28667da: Add an opt-in WebMCP agent-tools surface to Studio, off by default.

  When enabled, the prebuilt dashboard registers its existing RPC methods as WebMCP tools on a
  supporting browser's `document.modelContext`, so an agent on the open, authenticated tab can drive
  the same read, edit, and (with `--allow-spend`) provider actions the dashboard already exposes.
  Each tool is a 1:1 wrapper over the same authenticated server call, validation, and capability gate;
  registration grants no authority the tab did not already hold. Enable it with the new
  `verbatra studio --expose-agent-tools` flag or the `VERBATRA_STUDIO_AGENT_TOOLS` environment
  variable; both default to off. The two spend tools require both flags: `--expose-agent-tools` to
  expose the surface and `--allow-spend` to enable them.

### Patch Changes

- @verbatra/sdk@0.6.0

## 0.1.0

### Minor Changes

- 9e43dc1: Verbatra Studio is a redesigned application, from the information architecture down. It is
  organized as four pages in two sidebar zones: Translations (the daily workspace: a status banner
  with the last run's token figures, the key-by-locale explorer, and per-locale coverage with the
  lock file's state), Review (the flagged-entry queue with locale and key filters), Activity (the
  commit feed beside the last run's token and budget breakdown), and Settings (the session's
  capabilities plus the resolved configuration and glossary). The current page lives in the URL
  hash, so a reload lands back on the same page and browser back/forward work.

  The dashboard is now fully live: every page re-fetches on the file-watcher's refresh signal
  (coverage, the key diff, the lock state, the review queue, usage, and history), and the top bar
  carries a live indicator that turns amber while the stream reconnects. The key detail drawer is
  richer, showing the key's current source value and each locale's current translation alongside
  status and integrity, all updating live.

  Local editing needs no flag: the needs-review queue's edit, approve, and reject actions are
  available from the start, behind the loopback session and the same placeholder and ICU
  integrity gate as every write. Provider-calling actions (retranslate, translate pending) are
  opt-in via --allow-spend.

  The interface is rebuilt on Tailwind CSS with a reusable design system and a restrained, minimal
  look: overhauled dot-style badges, neutral elevation, and no page transitions. It ships a full
  light theme beside the dark one (System/Light/Dark switcher, persisted, following live OS
  changes on System), both contrast-checked against WCAG AA during development. Navigation is the
  flat four-page sidebar; every page is reachable in one click.

- 55c6af2: The Translations page's missing, changed, and orphaned key lists get their own distinct color
  vocabulary, separate from the status badges, since "what changed" and "is this correct" are
  different signals. When a project has nothing missing, changed, or orphaned in any locale, the
  page shows a single designed all-clear state instead of a wall of empty per-locale sections.

  Key and glossary translations render with right-to-left text direction for right-to-left locales
  such as Arabic, Hebrew, Persian, and Urdu.

  New: clicking a key opens a detail drawer showing that key's status per locale and the project's
  commit history for its locale files. The drawer supports a focus trap, closing with Escape, and
  returns focus to whatever was focused before it opened.

- 3f5fa4b: Two small, additive dashboard usability improvements.

  The Translations page gets a "Copy as review report" button that renders the full, currently
  loaded diff data (never the on-screen filtered or capped view) as a Markdown summary, per locale,
  the missing, changed, and orphaned key counts and key names, and copies it to the clipboard, with
  a brief "Copied" confirmation.

  RPC errors now render specific, actionable copy for known error codes (transport-level errors, sdk
  errors reachable through the read-only check, diff, and lock endpoints, and adapter parse errors on
  a target locale file), falling back to the existing generic message for any other code. Nothing
  about how errors are produced, redacted, or transported changes; this is a client-rendering
  improvement only.

- 674beb0: Add a provider-calling Studio action: an inline "Retranslate" button in the key detail drawer,
  for a locale row whose key currently fails placeholder or ICU integrity. Off by default;
  reachable only when the `verbatra studio` command is started with `--allow-spend` (or its
  environment variable equivalent). With the flag off, the action is absent from the dashboard,
  not merely disabled, and the underlying RPC method is absent from the server's own dispatch
  registry.

  Provider spend is the one gated capability: the server reaches a translation provider only when
  an operator opts in at process start, never through any request the dashboard itself can send.
  Local editing of the project's own locale files needs no flag and is always available.

  `project.snapshot`'s result gains a read-only `capabilities` field (`{ spend, writeToDisk }`);
  `spend` reflects the resolved flag and `writeToDisk` is always true, since local editing is
  always on. The dashboard uses it only to hide the retranslate affordance the server would refuse
  anyway, never as an authorization check.

  Internally, the RPC handler registry is now built per server instance from its resolved
  capabilities (`createRpcHandlers`) rather than a fixed module-level constant, and the
  retranslate method is gated by a dedicated, process-scoped rate limit at the dispatch layer.

  `key.integrity`'s per-locale result gains a new `icuValid: boolean` field (a boolean only, never a
  message string), and the key detail drawer's integrity pill gains a new danger state, "Invalid
  message syntax", for a target value that is placeholder-valid but fails ICU message-syntax
  validation, checked before the existing neutral "no placeholders" state. This is exactly the kind
  of failure the new Retranslate action exists to fix, so it was already covered by
  `canRetranslate`'s existing `tone === "danger"` gate once the pill itself learned to render it.

- 4515726: Add a new sdk function, `keyIntegrity`, that reports per changed key
  and target locale whether the format's placeholders or ICU structure
  still match between source and target: a boolean match result plus,
  on a mismatch, the specific placeholder tokens that are missing or
  extra. It reuses core's `checkPlaceholders` and an adapter's own
  `comparePlaceholders` exactly as they exist today; only "changed" keys
  are checked, since a missing or orphaned key has no value on one side
  to compare.

  Studio exposes this through a new read-only RPC method, `key.integrity`,
  scoped to exactly the one key currently open in the detail drawer,
  mirroring the existing `history.list` pattern of supplementary data
  fetched lazily on open rather than growing the already-uncapped
  `status.diff` payload. `KeyDetailDrawer` now renders an Integrity
  column with a pill: green for a match, red with the mismatched tokens
  for a mismatch, and neutral (never a false red) for a format with no
  placeholders at all. The pill reuses the existing `Badge` component
  and its success, neutral, and danger tones; no new styling is added.

  No RPC response carries a full source or target string value at any
  point, only the boolean result and, on a mismatch, the specific
  placeholder tokens involved.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the
  same bump; its own behavior is unchanged.

- 45a7774: Commit history rows (in the Activity feed and in the commit history section of a key's detail
  drawer) now show which locale files each commit touched, as a row of file chips under the
  summary line. This data was already present in every response from the underlying commit-history
  API; it just was not rendered before.
- ea054a2: Studio's live-refresh SSE channel now reports a real, still-content-free key delta instead of a
  blank "something changed" signal. `RefreshEvent` gains two optional fields, `locale` and `delta`
  (`added`/`changed`/`removed` counts), populated for `"source"` and `"targets"` refresh events; a
  `"lock"` event is unchanged. The `targets` watch category is now split into one chokidar watcher and
  one debounce per configured target locale, so a change to one target locale's file is distinguishable
  from a change to another, and each locale reports its own delta.

  The delta is a plain content diff of one locale file against its own last observed snapshot (taken at
  Studio startup and after every settled change), independent of source drift or the lock baseline.
  This is a deliberate semantics choice: it is the only reading under which a translator hand-editing an
  existing translation's wording, with the key itself untouched, is ever detected as a change. Two rapid
  changes to the same locale file, close enough together that the second's debounce window opens while
  the first's snapshot read is still in flight, are serialized so the second's reported delta is always
  correct against the first's settled state, never a stale or out-of-order baseline.

  `@verbatra/sdk` gains a new small read-only module, `readLocaleFileSnapshot` and
  `diffLocaleSnapshots`, exported for this purpose: reading one locale file through the configured
  adapter into a per-key content hash, and comparing two such snapshots into added/changed/removed
  counts. No translation string, key name, or file content ever crosses the SSE wire, only locale codes
  and counts.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump with no behavior
  change of its own.

- 68b3ee8: The Translations page's key explorer gets a grid view: rows are keys, columns are target
  locales, and each cell
  shows that key's status (missing, changed, orphaned, or in sync) with the same color and badge
  vocabulary as the rest of the dashboard. Each locale column header shows its completeness
  percentage. Grid is the default view; the previous flat per-locale key lists stay reachable as a
  "List" view through a toggle above the table.

  The grid supports keyboard-first navigation: arrow keys move between cells and wrap at the grid's
  edges, Enter or Space opens the key detail drawer for the focused row's key, and Escape closes it.
  Only the currently focused cell is in the Tab order, so tabbing into the grid and back out stays a
  single stop either way.

- d99347a: Add a live needs-review queue to Verbatra Studio: a new Review page listing every `(locale, key)`
  pair the most recent CLI run flagged for human review, backed by a new unconditional read RPC
  method, `review.queue`, that passes through the sdk's existing `runStatus()` result with no new
  computation. Each row shows a distinct, human-readable label for its `ReviewReasonCode`s; an
  unavailable snapshot (no run has been recorded yet) renders an informational empty state, never an
  error.

  Each row also gets three actions: Approve and Reject are purely client-side dismissals, held in
  an in-memory "actioned this session" overlay that survives the existing SSE `refresh`-triggered
  re-fetch and resets only on a page reload, never persisted to disk or the lock file. Edit opens a
  dialog that fetches the key's current source and target through a new RPC method, `key.value`,
  then submits a correction through a new RPC method, `translation.editEntry`. Both methods
  register unconditionally, need no capability flag, never call a provider, and are independent of
  `--allow-spend`. `translation.editEntry` gets its own dispatch-layer rate limit, reusing the
  existing rate-limiter mechanism already built for `translation.retranslateEntry`.

  All new UI reuses the existing badge, data-table, drawer, and retranslate-action design tokens and
  component patterns; no new CSS custom property is introduced. No change to Excel export or import,
  or to any code under `packages/exchange`.

- ccd41e6: Studio's live-refresh toast now renders. Previously the SSE channel already carried a `locale`
  and a per-key `delta` (added/changed/removed counts) on every `"source"`/`"targets"` refresh
  event, but the client discarded both fields and nothing rendered them. A toast now appears for
  any event carrying a nonzero delta, showing which category changed and a summary built from the
  nonzero counts, with a manual dismiss.

  A `"source"`-reason toast (the source locale file drifted) also gets a "translate pending changes
  across all locales" action, gated on `--allow-spend`: a new RPC method,
  `translation.translatePending`, wraps the sdk's unfiltered `translate()`, the exact whole-project
  call `verbatra translate` already performs. A `"targets"`-reason toast (a target locale file's own
  content changed) never gets this action: `translate()`'s diff cannot see most target-content
  changes, so the action would either do nothing or spend on unrelated drift; the existing
  key-scoped retranslate action is the right tool for a bad target value.

  The new action is gated the same way as the existing retranslate action (`spend`), has its own
  dispatch-layer rate limit sized for its whole-project blast
  radius, and a process-wide in-flight guard answers a second overlapping call with a structured
  `ALREADY_IN_PROGRESS` (409) immediately instead of leaving it to block on the real per-locale
  lock. `StudioServerOptions` gains `translatePendingRateLimitWindowMs`/`translatePendingRateLimitMax`
  overrides, following the existing `retranslateRateLimitWindowMs`/`Max` pattern.

  `client/reconnect.ts`'s `parseRefreshEvent` now parses and passes through `locale` and `delta`,
  additive to its existing `{ reason, at }` parsing; a malformed field degrades to absent rather
  than dropping the frame. No change to the SSE wire format itself, which already carried both
  fields.

- 9ec55b6: Quiet the chrome and surface the review queue in the navigation. The header's permanent Live badge and the Settings session card are gone: a page being served at all implies a live local process, so connection state only appears while the stream is actually degraded, and the one startup fact worth keeping (whether provider actions were enabled) moves into the Configuration card. The Review nav entry now carries a live count of entries waiting for review, updated instantly by approve, reject, and accepted-edit actions.
- bc7678c: Redesign the Studio web UI around the Technical Precision visual language: an indigo primary, Inter and JetBrains Mono local font stacks, a compact 4px corner rhythm, and a constant dark-indigo navigation rail with grouped zones and documentation links. The Translations workspace now opens with a four-tile stat strip (keys needing attention, average coverage, locales in sync, last-run cost), the locale table carries count-style progress cells, the activity feed renders as a timeline, the glossary renders as a definition card, and drawers gain labeled panel headers. Translations can now be edited directly from the key detail drawer per locale when local editing is available, in addition to the existing review queue flow. All pages, RPC methods, capability gates, and accessibility behaviors are unchanged.
- 9fe4da7: Add a Usage tab showing the most recently persisted run's token totals and, when a token budget
  is configured, its ceiling, behavior, and whether it was reached. Backed by a new `usage.summary`
  RPC method, an unconditional read like the needs-review queue's own view, projecting the
  persisted run-status snapshot's run-wide `generatedAt`, `usage`, and `budget` fields unmodified.
  Never shows a fabricated `0`: a token-less provider's absent usage and an unsupported budget each
  render an explicit message instead. Displays the snapshot's own timestamp so it reads as "as of
  the last recorded run", never a live counter, and re-fetches through the same live-refresh
  plumbing every other panel already uses.

### Patch Changes

- bcd68e8: Rewrite all JSDoc from the implementation and remove non-documentation comments. Corrects stale documentation, including the read-only framing (Studio has gated write seams), the provider error-code coverage of the RPC gate, and references to removed panels.
- 7e486ed: Add `OPENAI_COMPATIBLE_API_KEY` to the exact-value redaction scrub list, alongside the four hosted providers' key environment variables, so a real key set for the `openai-compatible` provider is redacted from projected config strings and mapped error messages the same way the hosted providers' keys already are.
- dc8bf0e: Give the server's per-method throttle its own METHOD_RATE_LIMITED error code so the client no longer blames the translation provider for a purely local rate limit. The 429 answered by the RPC gate previously reused the provider code RATE_LIMITED, and the client copy table rendered it as "The translation provider is rate-limiting requests", sending users to investigate API keys and provider status for a transient local throttle. The transport 429 now carries METHOD_RATE_LIMITED and renders as "Studio is limiting how often this action can run. Wait a moment and try again." A genuine provider RATE_LIMITED, forwarded from a spend-path handler, keeps its provider-worded copy. Older clients that do not know the new code fall back to the server's own accurate message.
- 10bcf25: Let the final SSE shutdown frame flush before destroying connections on a graceful close. Destroying every socket in the same tick the frames were written discarded them before the loopback flushed, so a browser saw only a dropped connection and reconnected forever instead of showing the session-expired notice. A short grace period between the SSE hub's close and the connection teardown fixes the race; stopping the CLI now reliably lands the open dashboard on the session-expired screen. The redundant in-sync badge columns also leave the locale tables (the counts beside them already carry the same fact), and the reconnecting indicator waits out the normal connect handshake before appearing, so a fresh page load never flashes it.
- Updated dependencies [81dd225]
- Updated dependencies [a53e0c4]
- Updated dependencies [35fe0f6]
- Updated dependencies [bcd68e8]
- Updated dependencies [565eb89]
- Updated dependencies [874cf70]
- Updated dependencies [14e9719]
- Updated dependencies [0ae2f52]
- Updated dependencies [e617c6b]
- Updated dependencies [4c6fd52]
- Updated dependencies [440212e]
- Updated dependencies [54a641a]
- Updated dependencies [2127234]
- Updated dependencies [7d50d22]
- Updated dependencies [2ede9ae]
- Updated dependencies [400e044]
- Updated dependencies [e116642]
- Updated dependencies [f3fd15f]
- Updated dependencies [314aefa]
- Updated dependencies [4515726]
- Updated dependencies [ea054a2]
- Updated dependencies [d99347a]
- Updated dependencies [dfd2b77]
- Updated dependencies [435e048]
- Updated dependencies [10a264e]
- Updated dependencies [ad431ca]
- Updated dependencies [2fe16b2]
- Updated dependencies [b945e53]
  - @verbatra/sdk@0.5.0

## 0.1.0-next.6

### Patch Changes

- Updated dependencies [81dd225]
- Updated dependencies [435e048]
- Updated dependencies [ad431ca]
  - @verbatra/sdk@0.5.0-next.4

## 0.1.0-next.5

### Patch Changes

- Updated dependencies [35fe0f6]
- Updated dependencies [874cf70]
- Updated dependencies [e617c6b]
- Updated dependencies [dfd2b77]
  - @verbatra/sdk@0.5.0-next.3

## 0.1.0-next.4

### Patch Changes

- Updated dependencies [565eb89]
- Updated dependencies [4c6fd52]
- Updated dependencies [2127234]
- Updated dependencies [f3fd15f]
  - @verbatra/sdk@0.5.0-next.2

## 0.1.0-next.3

### Patch Changes

- 7e486ed: Add `OPENAI_COMPATIBLE_API_KEY` to the exact-value redaction scrub list, alongside the four hosted providers' key environment variables, so a real key set for the `openai-compatible` provider is redacted from projected config strings and mapped error messages the same way the hosted providers' keys already are.
- Updated dependencies [14e9719]
- Updated dependencies [440212e]
- Updated dependencies [54a641a]
- Updated dependencies [400e044]
- Updated dependencies [2fe16b2]
- Updated dependencies [b945e53]
  - @verbatra/sdk@0.5.0-next.1

## 0.1.0-next.2

### Patch Changes

- 4accc85: Republish through the automated release pipeline so the package carries an npm provenance attestation, matching `@verbatra/sdk` and `@verbatra/cli`. The initial release was published manually to bootstrap npm's Trusted Publishing for a brand-new package, which cannot generate provenance outside a CI environment; no functional change.

## 0.1.0-next.1

### Minor Changes

- bc0be98: Publish `@verbatra/studio` to npm as an optional companion package to `@verbatra/cli`. It can now be installed directly (`npm install @verbatra/studio`) or added alongside the CLI so the `verbatra studio` command has the dashboard available. This is a packaging change only; the dashboard itself works the same as before.

## 0.0.1-next.0

### Patch Changes

- Updated dependencies [5597f98]
- Updated dependencies [4a789ff]
  - @verbatra/sdk@0.5.0-next.0
