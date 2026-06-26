/**
 * The verbatra command-line interface: a thin wrapper over @verbatra/sdk that adds no translation,
 * diff, or lock logic of its own. Each subcommand validates its argv at the boundary, calls one SDK
 * entry point, and renders the result.
 *
 * Subcommands: `translate` (one-shot run), `watch` (re-run on each source change until interrupted),
 * `export` (write untranslated strings to a styled `.xlsx` workbook for a human translator), `import`
 * (read a filled workbook back into the locale files, running the same safety checks as `translate`),
 * and `init` (scaffold a config and `.env.example`, and gitignore the real `.env`).
 *
 * Common flags: `--cwd <path>` (resolve config and locale files against), `--config <path>` (load an
 * explicit config file instead of searching), and `--json` (structured output instead of the human
 * default). Per-command: `--dry-run` (translate/import: preview/validate without calling a provider or
 * writing), `--debounce <ms>` (watch only), `--out`/`--locales`/`--include-unchanged` (export only),
 * and `--provider`/`--source`/`--targets`/`--path`/`--yes`/`--force` (init only).
 *
 * Exit codes (the CI/script contract): `0` success; `1` `translate`/`import` finished but some locales
 * failed (a `watch` per-run failure is a stream record, not an exit code; `export`/`init` have no
 * per-locale failure mode); `2` could not run (a whole-run error or a usage error); `130` `watch` was
 * force-stopped by a second interrupt (a single interrupt stops gracefully and exits `0`).
 *
 * Output modes: human-readable by default; with `--json`, `translate`/`import` print the SDK's
 * `RunSummary` as one JSON object, `export` prints its result as one JSON object, and `watch` prints one
 * `WatchRunResult` per run as NDJSON. API keys are read only from the environment by the SDK's providers;
 * the CLI never takes a key (`init` only scaffolds the key NAME into `.env.example`, never a value).
 *
 * @packageDocumentation
 */

import process from "node:process";
import {
  check,
  diff,
  exportWorkbook,
  importWorkbook,
  loadConfig,
  translate,
  watch,
} from "@verbatra/sdk";
import { run } from "./run.js";

// The bin shim: the ONLY part touching process global state. It wires the real SDK, the real
// process streams, the SIGINT/SIGTERM handlers, and maps the core's returned code to process.exit.
// Kept tiny and coverage-excluded, like the SDK's wiring.ts and the providers' client.ts seams.
const code = await run(
  process.argv.slice(2),
  { loadConfig, translate, watch, exportWorkbook, importWorkbook, check, diff },
  {
    out: (text) => {
      process.stdout.write(text);
    },
    err: (text) => {
      process.stderr.write(text);
    },
  },
  {
    onWatchSession: (session) => {
      process.on("SIGINT", () => session.requestStop());
      process.on("SIGTERM", () => session.requestStop());
    },
  },
);

process.exit(code);
