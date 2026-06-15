/**
 * The verbatra command-line interface: a thin wrapper over @verbatra/sdk that adds no translation logic.
 *
 * Subcommands: `translate` (one-shot run) and `watch` (re-run on each source change until interrupted).
 * Flags: `--config <path>` (load an explicit config file), `--cwd <path>` (resolve config and locales
 * against), `--dry-run` (translate only — preview without calling a provider or writing), `--debounce
 * <ms>` (watch only), and `--json` (structured output instead of the human default).
 *
 * Exit codes (the CI/script contract): `0` success; `1` `translate` finished but some locales failed
 * (translate only — a `watch` per-run failure is a stream record, not an exit code); `2` could not run
 * (a whole-run error or a usage error); `130` `watch` was force-stopped by a second interrupt (a single
 * interrupt stops gracefully and exits `0`).
 *
 * Output modes: human-readable by default; with `--json`, `translate` prints the SDK's `RunSummary` as one
 * JSON object and `watch` prints one `WatchRunResult` per run as NDJSON. API keys are read only from the
 * environment by the SDK's providers; the CLI never takes a key.
 *
 * Usage: `verbatra translate [--config <path>] [--cwd <path>] [--dry-run] [--json]`
 *
 * @packageDocumentation
 */

import process from "node:process";
import { loadConfig, translate, watch } from "@verbatra/sdk";
import { run } from "./run.js";

// The bin shim: the ONLY part touching process global state. It wires the real SDK, the real
// process streams, the SIGINT/SIGTERM handlers, and maps the core's returned code to process.exit.
// Kept tiny and coverage-excluded, like the SDK's wiring.ts and the providers' client.ts seams.
const code = await run(
  process.argv.slice(2),
  { loadConfig, translate, watch },
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
