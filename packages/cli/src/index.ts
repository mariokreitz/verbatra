/**
 * The verbatra command-line interface: a thin wrapper over @verbatra/sdk. Each subcommand validates
 * its argv, calls one SDK entry point, and renders the result.
 *
 * Subcommands: `translate`, `watch`, `export`, `import`, `check`, `diff`, `studio`, and `init`.
 *
 * Exit codes (the CI/script contract): `0` success; `1` `translate`/`import` finished but some locales
 * failed, or `check`/`diff` found drift/pending changes; `2` could not run (a whole-run error or a
 * usage error); `130` `watch` or `studio` force-stopped by a second interrupt.
 *
 * API keys are read only from the environment by the SDK's providers; the CLI never takes a key.
 * `studio` reaches @verbatra/studio only through a dynamic import, so it never fails to load merely
 * because that package is not installed.
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
  loadConfigWithMeta,
  translate,
  watch,
} from "@verbatra/sdk";
import { run } from "./run.js";

// The bin shim is the only part touching process global state; it is kept tiny and coverage-excluded.
const code = await run(
  process.argv.slice(2),
  {
    loadConfig,
    translate,
    watch,
    exportWorkbook,
    importWorkbook,
    check,
    diff,
    loadConfigWithMeta,
    importStudio: () => import("@verbatra/studio"),
  },
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
    onStudioSession: (session) => {
      process.on("SIGINT", () => session.requestStop());
      process.on("SIGTERM", () => session.requestStop());
    },
  },
);

process.exit(code);
