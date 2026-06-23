import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import { z } from "zod";
import { loadEnvFiles } from "./env.js";
import { runInit } from "./init.js";
import {
  renderError,
  renderExportHuman,
  renderExportJson,
  renderHuman,
  renderJson,
  toRenderableError,
} from "./render.js";
import type { CliDeps, InitOpts, RunHooks, Streams } from "./types.js";
import { runWatch } from "./watch-session.js";

// INVARIANT: package.json sits one directory above the running module. That holds for both
// src/run.ts (tests) and the bundled dist/index.js (built and published bin), so the same
// "../package.json" offset resolves in both. If the tsup output depth changes, preserve this
// offset, or the built bin breaks while the in-process test stays green.
function readPackageVersion(): string {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const { version } = JSON.parse(readFileSync(manifestUrl, "utf8")) as { version: string };
  return version;
}

const CLI_VERSION = readPackageVersion();

interface SharedOpts {
  readonly cwd?: string;
  readonly config?: string;
}
interface TranslateOpts extends SharedOpts {
  readonly dryRun?: boolean;
  readonly json?: boolean;
}
interface WatchOpts extends SharedOpts {
  readonly debounce?: string;
  readonly json?: boolean;
}

/**
 * zod schemas for the export/import command flags. Commander hands strings (or undefined) and
 * booleans; the schema is the typed boundary between untrusted argv and the SDK call. `locales`
 * is a comma-separated list, normalized to a trimmed non-empty array (or omitted).
 */
const localeListSchema = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined
      ? undefined
      : value
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
  );

const exportOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  out: z.string().optional(),
  locales: localeListSchema,
  includeUnchanged: z.boolean().optional(),
  json: z.boolean().optional(),
});

const importOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  dryRun: z.boolean().optional(),
  json: z.boolean().optional(),
});

/** loadConfig options from the resolved working directory and the explicit-config flag. */
function loadOptions(opts: SharedOpts, cwd: string): { cwd: string; configPath?: string } {
  return {
    cwd,
    ...(opts.config !== undefined ? { configPath: opts.config } : {}),
  };
}

function parseDebounce(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const ms = Number.parseInt(value, 10);
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

async function runTranslate(opts: TranslateOpts, deps: CliDeps, streams: Streams): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  loadEnvFiles(cwd);
  let config: Awaited<ReturnType<CliDeps["loadConfig"]>>;
  try {
    config = await deps.loadConfig(loadOptions(opts, cwd));
    const summary = await deps.translate({
      config,
      cwd,
      ...(opts.dryRun === true ? { dryRun: true } : {}),
    });
    streams.out(opts.json === true ? `${renderJson(summary)}\n` : `${renderHuman(summary)}\n`);
    return summary.failed.length > 0 ? 1 : 0;
  } catch (error) {
    // A whole-run failure (config/format/provider/source/lock) is a structured SdkError: render it
    // to stderr (so stdout stays empty/pipeable under --json) and exit 2 ("could not run").
    streams.err(`${renderError(toRenderableError(error))}\n`);
    return 2;
  }
}

async function runWatchCommand(
  opts: WatchOpts,
  deps: CliDeps,
  streams: Streams,
  hooks: RunHooks,
): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  loadEnvFiles(cwd);
  let config: Awaited<ReturnType<CliDeps["loadConfig"]>>;
  try {
    config = await deps.loadConfig(loadOptions(opts, cwd));
  } catch (error) {
    streams.err(`${renderError(toRenderableError(error))}\n`);
    return 2;
  }
  const debounceMs = parseDebounce(opts.debounce);
  const session = runWatch(
    {
      config,
      json: opts.json === true,
      cwd,
      ...(debounceMs !== undefined ? { debounceMs } : {}),
    },
    deps,
    streams,
  );
  hooks.onWatchSession?.(session);
  return session.done;
}

/**
 * Run the `export` command: validate the flags, load the config, call the SDK's `exportWorkbook`,
 * and render the result. Returns `0` on success and `2` when the run could not start (a structured
 * SdkError, rendered to stderr). Export has no per-locale failure mode, so it never returns `1`.
 *
 * @param rawOpts - the raw commander options (validated by `exportOptsSchema`)
 * @returns the process exit code (`0` success, `2` whole-run failure)
 */
async function runExport(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<number> {
  const opts = exportOptsSchema.parse(rawOpts);
  const cwd = opts.cwd ?? process.cwd();
  try {
    const config = await deps.loadConfig(
      loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
    );
    const result = await deps.exportWorkbook({
      config,
      cwd,
      ...(opts.out !== undefined ? { out: opts.out } : {}),
      ...(opts.locales !== undefined ? { locales: opts.locales } : {}),
      ...(opts.includeUnchanged === true ? { includeUnchanged: true } : {}),
    });
    streams.out(
      opts.json === true ? `${renderExportJson(result)}\n` : `${renderExportHuman(result)}\n`,
    );
    return 0;
  } catch (error) {
    streams.err(`${renderError(toRenderableError(error))}\n`);
    return 2;
  }
}

/**
 * Run the `import` command: validate the flags, load the config, call the SDK's `importWorkbook`,
 * and render the run summary. The exit-code rule matches `translate`: `1` when any locale failed,
 * `0` when all succeeded, and `2` when the run could not start (a structured SdkError to stderr).
 *
 * @param workbook - the path to the filled workbook to import
 * @param rawOpts - the raw commander options (validated by `importOptsSchema`)
 * @returns the process exit code (`0` all locales succeeded, `1` a locale failed, `2` whole-run failure)
 */
async function runImport(
  workbook: string,
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
): Promise<number> {
  const opts = importOptsSchema.parse(rawOpts);
  const cwd = opts.cwd ?? process.cwd();
  try {
    const config = await deps.loadConfig(
      loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
    );
    const summary = await deps.importWorkbook({
      config,
      workbook,
      cwd,
      ...(opts.dryRun === true ? { dryRun: true } : {}),
    });
    streams.out(
      opts.json === true ? `${renderJson(summary)}\n` : `${renderHuman(summary, "import")}\n`,
    );
    // Identical exit-code rule to translate: 1 when any locale failed, else 0.
    return summary.failed.length > 0 ? 1 : 0;
  } catch (error) {
    streams.err(`${renderError(toRenderableError(error))}\n`);
    return 2;
  }
}

function buildProgram(
  deps: CliDeps,
  streams: Streams,
  hooks: RunHooks,
  setCode: (code: number) => void,
): Command {
  const program = new Command();
  program
    .name("verbatra")
    .description(
      "Automate i18n translation and keep your locale files in sync across languages with AI and machine-translation providers",
    )
    .version(CLI_VERSION)
    .exitOverride()
    .configureOutput({ writeOut: (s) => streams.out(s), writeErr: (s) => streams.err(s) });

  program
    .command("translate")
    .description("Translate every target locale once, then exit")
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--dry-run", "preview changes without calling a provider or writing files")
    .option("--json", "print the run summary as JSON")
    .action(async (opts: TranslateOpts) => {
      setCode(await runTranslate(opts, deps, streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra translate                 translate once using the config it finds",
        "  $ verbatra translate --dry-run       preview changes without calling a provider",
        "  $ verbatra translate --json          machine-readable summary on stdout",
      ].join("\n"),
    );

  program
    .command("watch")
    .description("Re-translate on every source change until interrupted")
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option(
      "--debounce <ms>",
      "wait this many milliseconds after a change before translating (default 300)",
    )
    .option("--json", "print each run as one NDJSON record")
    .action(async (opts: WatchOpts) => {
      setCode(await runWatchCommand(opts, deps, streams, hooks));
    });

  program
    .command("export")
    .description("Export untranslated strings into a styled Excel workbook for a human translator")
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--out <path>", "write the workbook to this path (default verbatra-translations.xlsx)")
    .option("--locales <list>", "comma-separated subset of target locales (default all configured)")
    .option("--include-unchanged", "also export already up-to-date strings (off by default)")
    .option("--json", "print the export result as JSON")
    .action(async (opts: unknown) => {
      setCode(await runExport(opts, deps, streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra export                       write the workbook with missing and changed strings",
        "  $ verbatra export --locales de,fr       only the German and French sheets",
        "  $ verbatra export --include-unchanged   include already up-to-date strings",
      ].join("\n"),
    );

  program
    .command("import")
    .argument("<workbook>", "path to the filled workbook to import")
    .description(
      "Import a filled workbook back into the locale files, running the same safety checks",
    )
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--dry-run", "validate and report without writing locale files or updating the lock")
    .option("--json", "print the run summary as JSON")
    .action(async (workbook: string, opts: unknown) => {
      setCode(await runImport(workbook, opts, deps, streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra import translations.xlsx             import the filled workbook",
        "  $ verbatra import translations.xlsx --dry-run   validate and report, write nothing",
      ].join("\n"),
    );

  program
    .command("init")
    .description("Create a verbatra config and .env example for this project")
    .option("--cwd <path>", "write the config and env files to this directory")
    .option(
      "--provider <id>",
      "translation provider to use: anthropic, openai, gemini, or deepl (required unless prompted)",
    )
    .option("--source <locale>", "locale your source strings are written in (default en)")
    .option("--targets <locales>", "comma-separated locales to translate into (default de)")
    .option(
      "--path <pattern>",
      "locale file pattern containing the {locale} token (default locales/{locale}.json)",
    )
    .option("--yes", "skip prompts and accept the defaults")
    .option("--force", "overwrite an existing config or .env.example")
    .action(async (opts: InitOpts) => {
      setCode(await runInit(opts, streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra init --provider anthropic        create config + .env example, prompting for the rest",
        "  $ verbatra init --provider deepl --yes      non-interactive, accept all defaults",
      ].join("\n"),
    );

  return program;
}

/**
 * The CLI core: parse argv, dispatch to one SDK entry point, render, and RETURN an exit code. It
 * never calls process.exit and never touches process streams. The bin shim wires those. Usage
 * errors (commander) map to 2; --help/--version exit 0.
 *
 * @param argv - The user arguments (process.argv without node and the script path).
 * @param deps - The SDK entry points to call (injected so tests pass offline stubs).
 * @param streams - The stdout/stderr sink the CLI writes through.
 * @param hooks - Optional real-world wiring (e.g. attaching the signal handler to a watch session).
 * @returns The process exit code:
 *   `0` success (or `--help`/`--version`); `1` `translate` finished but some locales failed (translate
 *   only: a `watch` per-run failure is a stream record, not an exit code); `2` could not run, covering
 *   BOTH a whole-run `SdkError` and a commander usage error; `130` `watch` was force-stopped by a second
 *   interrupt (a single interrupt stops gracefully and resolves `0`).
 * @throws Re-throws a non-`CommanderError` thrown during parsing (an unexpected error); commander usage
 *   errors are mapped to an exit code, not thrown.
 */
export async function run(
  argv: readonly string[],
  deps: CliDeps,
  streams: Streams,
  hooks: RunHooks = {},
): Promise<number> {
  let code = 0;
  const program = buildProgram(deps, streams, hooks, (c) => {
    code = c;
  });
  try {
    await program.parseAsync([...argv], { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      // --help / --version resolve to exitCode 0; any usage error -> 2 ("could not run"),
      // distinct from a per-locale failure (1).
      return error.exitCode === 0 ? 0 : 2;
    }
    throw error;
  }
  return code;
}
