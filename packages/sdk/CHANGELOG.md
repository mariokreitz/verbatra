# @verbatra/sdk

## 0.1.0

### Minor Changes

- c5d8cd6: Add an optional `configPath` to `loadConfig`'s options for loading one explicit config file instead
  of searching. When given, the loader resolves the path (relative against `cwd`, absolute as-is) and
  loads it through cosmiconfig's `load()`, which reuses the same loaders search uses (.json/.yaml/.ts via
  the TypeScript loader), then validates it through the same zod boundary. A genuinely missing file is
  `CONFIG_NOT_FOUND`; a present-but-unparseable or invalid file is `CONFIG_INVALID` — both existing
  codes, no new error code. Precedence is `configOverride` > `configPath` > search. Purely additive: when
  `configPath` is absent, `loadConfig` behaves exactly as before (the existing config-loading tests are
  unchanged). This unblocks the CLI's `--config <path>` flag as a thin pass-through.
- 8861ed8: Add @verbatra/sdk, the central orchestration API and the first SDK slice: the one-shot
  end-to-end translate flow that composes core, format-adapters, and ai-providers
  (config -> read -> diff -> translate -> write) with verbatra.lock.json as the
  change-detection baseline.

  The SDK adds no format, provider, or hashing logic of its own: it loads and zod-validates
  the config (cosmiconfig + cosmiconfig-typescript-loader, supporting a code-defined
  verbatra.config.ts via defineConfig and file-based configs, first-found-wins),
  selects an adapter by explicit format, constructs the configured provider (key read from
  env by the provider, never by the SDK), injects the selected adapter's own placeholder
  extractor into every translate request, routes the glossary term-map to the provider and
  surfaces provider notices, and reuses core's diffResources and contentHash.

  Per target locale it reads source + target, diffs against the lock-file baseline,
  translates only missing/changed keys (skipping invalid-ICU source), enforces per-key
  integrity (a failed key is withheld from the file and not lock-updated, so it retries),
  writes back preserving structure/order, and updates the lock-file. Locales are isolated:
  one locale's failure does not roll back others and the run continues. Dry-run reads + diffs

  - reports without constructing or calling the provider and without writing any file or the
    lock-file. Watch mode is intentionally deferred to a later slice.

- 1390e2d: Add watch mode: a long-running wrapper over the one-shot translate flow. It watches the configured
  source file, debounces filesystem events (300 ms default, configurable), and re-runs the existing
  one-shot `translate()` on each settled change. Runs are serialized and coalesced through an
  IDLE/RUNNING state machine with a single boolean pending-rerun flag: a change during a run never
  starts a concurrent run, and any number of mid-run changes collapse into exactly one immediate
  follow-up (no fresh debounce). Watch adds no translation, diff, or lock logic of its own — each run
  is the slice-1 flow unchanged, so the lock-file and per-locale atomic writes are reused as-is. An
  initial run happens on startup; a missing source path at startup is a hard `SOURCE_UNREADABLE`
  error, while a run that fails after start is reported and watching continues. Run summaries and
  failures are surfaced through a caller-supplied `onRun` callback (the SDK does no logging and puts
  no secret on the output path); the failed result carries only a secret-free `{code, message}`. The
  returned controller exposes `stop()`, which stops accepting triggers, discards any pending
  follow-up, closes the watcher, and awaits the in-flight run to completion (signal wiring such as
  SIGINT lives in the cli wrapper, not the SDK). New dependency: `chokidar` (pinned exact).
