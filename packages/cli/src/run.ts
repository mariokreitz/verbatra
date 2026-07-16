import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import { z } from "zod";
import { loadEnvFiles } from "./env.js";
import { runInit } from "./init.js";
import {
  renderCheckHuman,
  renderCheckJson,
  renderDiffHuman,
  renderDiffJson,
  renderError,
  renderExportHuman,
  renderExportJson,
  renderHuman,
  renderJson,
  toRenderableError,
} from "./render.js";
import { runStudio } from "./studio-command.js";
import type { CliDeps, InitOpts, RunHooks, Streams } from "./types.js";
import { runWatch } from "./watch-session.js";

// The "../package.json" offset must resolve from both src/run.ts and the bundled dist/index.js;
// preserve it if the tsup output depth changes.
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

// A comma-separated locale list normalized to a trimmed non-empty array (or omitted).
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

const translateOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  dryRun: z.boolean().optional(),
  prune: z.boolean().optional(),
  json: z.boolean().optional(),
});

const watchOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  debounce: z.string().optional(),
  json: z.boolean().optional(),
});
type WatchOpts = z.infer<typeof watchOptsSchema>;

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

const checkOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  locales: localeListSchema,
  json: z.boolean().optional(),
});

const diffOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  locales: localeListSchema,
  json: z.boolean().optional(),
});

/** A CLI-local usage error for a malformed option value; routed to exit 2 like an `SdkError`. */
class UsageError extends Error {
  /** Stable, secret-free code read by {@link toRenderableError}; branch on this, not the message. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "UsageError";
    this.code = code;
  }
}

/** Render a caught error to stderr as one structured line and return exit `2`. */
function renderFailureExit2(streams: Streams, error: unknown): number {
  streams.err(`${renderError(toRenderableError(error))}\n`);
  return 2;
}

/**
 * Run a synchronous option-parsing step inside a try that renders any parse or usage failure to
 * stderr and returns exit `2`, keeping stdout clean for `--json`. On success the parsed options are
 * handed to `body`. This is the single copy of the parse/render/return-2 wiring shared by every
 * command's option parsing.
 */
async function withParsedOpts<T>(
  parse: () => T,
  streams: Streams,
  body: (opts: T) => Promise<number>,
): Promise<number> {
  let opts: T;
  try {
    opts = parse();
  } catch (error) {
    return renderFailureExit2(streams, error);
  }
  return body(opts);
}

/**
 * Parse a locale command's options and reject a provided-but-empty `--locales` list. `localeListSchema`
 * normalizes `""` and `","` to an empty array (defined, not undefined), which would otherwise select no
 * locales and let a CI drift gate exit 0. An omitted flag stays `undefined` and is allowed.
 *
 * @throws {@link UsageError} `INVALID_LOCALES` when `locales` is provided but lists no locale.
 */
function parseLocaleCommandOpts<T extends { readonly locales?: readonly string[] | undefined }>(
  schema: z.ZodType<T>,
  rawOpts: unknown,
): T {
  const opts = schema.parse(rawOpts);
  if (opts.locales !== undefined && opts.locales.length === 0) {
    throw new UsageError(
      "INVALID_LOCALES",
      "The --locales option was provided but lists no locale. Pass a comma-separated list of " +
        "configured target locales, or omit --locales to use all of them.",
    );
  }
  return opts;
}

/**
 * Parse a locale command's options inside the shared parse/render/return-2 scaffold. On success the
 * parsed options are handed to `body`. Used by `check`, `diff`, and `export`.
 */
async function withLocaleOpts<T extends { readonly locales?: readonly string[] | undefined }>(
  schema: z.ZodType<T>,
  rawOpts: unknown,
  streams: Streams,
  body: (opts: T) => Promise<number>,
): Promise<number> {
  return withParsedOpts(() => parseLocaleCommandOpts(schema, rawOpts), streams, body);
}

function loadOptions(opts: SharedOpts, cwd: string): { cwd: string; configPath?: string } {
  return {
    cwd,
    ...(opts.config !== undefined ? { configPath: opts.config } : {}),
  };
}

/**
 * Shared whole-run error scaffold for the one-shot commands: run `beforeLoad` (if given), load the
 * config, then run the body, all in one try, mapping any thrown error to stderr and exit `2` while
 * leaving stdout clean for `--json`. A `1` comes only from a body that returns it without throwing. The
 * `await` on `body` is load-bearing: returning it unawaited would let a rejection escape this try as an
 * unhandled rejection.
 *
 * @param beforeLoad - An optional step (e.g. loading `.env` files) run before `loadConfig`, inside the
 *   same try, so a non-ENOENT read error is rendered structurally instead of escaping unhandled.
 */
async function withWholeRunErrors(
  deps: CliDeps,
  streams: Streams,
  loadOpts: { cwd: string; configPath?: string },
  body: (config: Awaited<ReturnType<CliDeps["loadConfig"]>>) => Promise<number>,
  beforeLoad?: () => void,
): Promise<number> {
  try {
    beforeLoad?.();
    const config = await deps.loadConfig(loadOpts);
    return await body(config);
  } catch (error) {
    return renderFailureExit2(streams, error);
  }
}

/**
 * Parse `--debounce` into milliseconds. An omitted flag stays `undefined` (watch applies its own
 * 300ms default). A given value must be a bare positive integer string; anything else (non-numeric,
 * zero, negative, or a unit suffix like "250ms") is a usage error, never a silent fallback to the
 * default.
 *
 * @throws {@link UsageError} `INVALID_DEBOUNCE` when `value` is not a positive integer string.
 */
function parseDebounce(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(value) || Number.parseInt(value, 10) <= 0) {
    throw new UsageError(
      "INVALID_DEBOUNCE",
      `The --debounce option must be a positive whole number of milliseconds, got "${value}".`,
    );
  }
  return Number.parseInt(value, 10);
}

/**
 * Run the `translate` command. Exported so a test can call it directly with a malformed `rawOpts`
 * object: every field on `translateOptsSchema` is an optional string or boolean, which real commander
 * argv always produces correctly, so no CLI flag can organically trigger a `ZodError` for this command.
 */
export async function runTranslate(
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
): Promise<number> {
  return withParsedOpts(
    () => translateOptsSchema.parse(rawOpts),
    streams,
    async (opts) => {
      const cwd = opts.cwd ?? process.cwd();
      return withWholeRunErrors(
        deps,
        streams,
        loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
        async (config) => {
          const summary = await deps.translate({
            config,
            cwd,
            ...(opts.dryRun === true ? { dryRun: true } : {}),
            ...(opts.prune === true ? { prune: true } : {}),
          });
          streams.out(
            opts.json === true ? `${renderJson(summary)}\n` : `${renderHuman(summary)}\n`,
          );
          return summary.failed.length > 0 ? 1 : 0;
        },
        () => loadEnvFiles(cwd),
      );
    },
  );
}

/** `watchOptsSchema`'s shape plus the debounce value already parsed to milliseconds. */
interface ParsedWatchOpts extends WatchOpts {
  readonly debounceMs?: number;
}

/**
 * Parse and validate the `watch` command's options: the zod schema shape, then `--debounce` on top.
 * Both run here so a single {@link withParsedOpts} call covers either failure.
 */
function parseWatchCommandOpts(rawOpts: unknown): ParsedWatchOpts {
  const opts = watchOptsSchema.parse(rawOpts);
  const debounceMs = parseDebounce(opts.debounce);
  return { ...opts, ...(debounceMs !== undefined ? { debounceMs } : {}) };
}

async function runWatchCommand(
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
  hooks: RunHooks,
): Promise<number> {
  return withParsedOpts(
    () => parseWatchCommandOpts(rawOpts),
    streams,
    async (opts) => {
      const cwd = opts.cwd ?? process.cwd();
      let config: Awaited<ReturnType<CliDeps["loadConfig"]>>;
      try {
        loadEnvFiles(cwd);
        config = await deps.loadConfig(
          loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
        );
      } catch (error) {
        return renderFailureExit2(streams, error);
      }
      const session = runWatch(
        {
          config,
          json: opts.json === true,
          cwd,
          ...(opts.debounceMs !== undefined ? { debounceMs: opts.debounceMs } : {}),
        },
        deps,
        streams,
      );
      hooks.onWatchSession?.(session);
      return session.done;
    },
  );
}

/**
 * Run the `studio` command: start Verbatra Studio. `runStudio` resolves once startup either succeeds
 * (the server is bound and the banner printed) or fails (a rendered error and exit `2`); either way
 * the hook is wired to the returned session so a later SIGINT/SIGTERM can request a clean shutdown.
 */
async function runStudioCommand(
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
  hooks: RunHooks,
): Promise<number> {
  const session = await runStudio(rawOpts, deps, streams);
  hooks.onStudioSession?.(session);
  return session.done;
}

/**
 * Run the `export` command. Returns `0` on success and `2` when the run could not start. Export has
 * no per-locale failure mode, so it never returns `1`.
 */
async function runExport(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<number> {
  return withLocaleOpts(exportOptsSchema, rawOpts, streams, async (opts) => {
    const cwd = opts.cwd ?? process.cwd();
    return withWholeRunErrors(
      deps,
      streams,
      loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
      async (config) => {
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
      },
    );
  });
}

/**
 * Run the `import` command. Exit codes match `translate`: `0` all locales succeeded, `1` a locale
 * failed, `2` the run could not start. Exported for the same reason as {@link runTranslate}: every
 * field on `importOptsSchema` is an optional string or boolean, so no CLI flag can organically trigger
 * a `ZodError`; a test calls this directly with a malformed `rawOpts` instead.
 */
export async function runImport(
  workbook: string,
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
): Promise<number> {
  return withParsedOpts(
    () => importOptsSchema.parse(rawOpts),
    streams,
    async (opts) => {
      const cwd = opts.cwd ?? process.cwd();
      return withWholeRunErrors(
        deps,
        streams,
        loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
        async (config) => {
          const summary = await deps.importWorkbook({
            config,
            workbook,
            cwd,
            ...(opts.dryRun === true ? { dryRun: true } : {}),
          });
          streams.out(
            opts.json === true ? `${renderJson(summary)}\n` : `${renderHuman(summary, "import")}\n`,
          );
          return summary.failed.length > 0 ? 1 : 0;
        },
      );
    },
  );
}

/**
 * Run the read-only `check` command. Exit codes: `0` every locale in sync, `1` at least one locale
 * has a missing or stale key, `2` the run could not start.
 */
async function runCheck(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<number> {
  return withLocaleOpts(checkOptsSchema, rawOpts, streams, async (opts) => {
    const cwd = opts.cwd ?? process.cwd();
    return withWholeRunErrors(
      deps,
      streams,
      loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
      async (config) => {
        const summary = await deps.check({
          config,
          cwd,
          ...(opts.locales !== undefined ? { locales: opts.locales } : {}),
        });
        streams.out(
          opts.json === true ? `${renderCheckJson(summary)}\n` : `${renderCheckHuman(summary)}\n`,
        );
        return summary.inSync ? 0 : 1;
      },
    );
  });
}

/**
 * Run the read-only `diff` command. Exit codes: `0` no pending changes, `1` at least one locale has a
 * missing or changed key (orphaned keys alone never produce `1`), `2` the run could not start.
 */
async function runDiff(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<number> {
  return withLocaleOpts(diffOptsSchema, rawOpts, streams, async (opts) => {
    const cwd = opts.cwd ?? process.cwd();
    return withWholeRunErrors(
      deps,
      streams,
      loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
      async (config) => {
        const summary = await deps.diff({
          config,
          cwd,
          ...(opts.locales !== undefined ? { locales: opts.locales } : {}),
        });
        streams.out(
          opts.json === true ? `${renderDiffJson(summary)}\n` : `${renderDiffHuman(summary)}\n`,
        );
        return summary.hasPendingChanges ? 1 : 0;
      },
    );
  });
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
    .option(
      "--prune",
      "remove orphaned keys (in a target file but absent from source) from the written file",
    )
    .option("--json", "print the run summary as JSON")
    .action(async (opts: unknown) => {
      setCode(await runTranslate(opts, deps, streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra translate                 translate once using the config it finds",
        "  $ verbatra translate --dry-run       preview changes without calling a provider",
        "  $ verbatra translate --prune         also remove orphaned keys from target files",
        "  $ verbatra translate --prune --dry-run  preview the keys that would be pruned",
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
    .action(async (opts: unknown) => {
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
    .command("check")
    .description("Report which keys are missing or stale per locale without writing files")
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--locales <list>", "comma-separated subset of target locales (default all configured)")
    .option("--json", "print the check summary as JSON")
    .action(async (opts: unknown) => {
      setCode(await runCheck(opts, deps, streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra check                  report missing and stale keys per locale (exit 1 if drifted)",
        "  $ verbatra check --locales de,fr  only check the German and French locales",
        "  $ verbatra check --json           machine-readable status on stdout for CI",
      ].join("\n"),
    );

  program
    .command("diff")
    .description(
      "Show the keys that would be added, re-translated, or orphaned per locale without writing files",
    )
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--locales <list>", "comma-separated subset of target locales (default all configured)")
    .option("--json", "print the diff summary as JSON")
    .action(async (opts: unknown) => {
      setCode(await runDiff(opts, deps, streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra diff                  list the pending keys per locale (exit 1 if any are pending)",
        "  $ verbatra diff --locales de,fr  only diff the German and French locales",
        "  $ verbatra diff --json           machine-readable key lists on stdout for CI",
      ].join("\n"),
    );

  program
    .command("studio")
    .description("Start Verbatra Studio, the local translation dashboard")
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--port <n>", "override the default Studio port (must be 1-65535)")
    .option(
      "--allow-spend",
      "allow Studio to call a translation provider (also: VERBATRA_STUDIO_ALLOW_SPEND)",
    )
    .action(async (opts: unknown) => {
      setCode(await runStudioCommand(opts, deps, streams, hooks));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra studio                start Verbatra Studio on the default port",
        "  $ verbatra studio --port 6000    start Verbatra Studio on a specific port",
        "  $ verbatra studio --allow-spend  start Studio with retranslate enabled",
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
 * The CLI core: parse argv, dispatch to one SDK entry point, render, and return an exit code. It never
 * calls process.exit and never touches process streams; the bin shim wires those.
 *
 * @param argv - The user arguments (process.argv without node and the script path).
 * @param deps - The SDK entry points to call (injected so tests pass offline stubs).
 * @param streams - The stdout/stderr sink the CLI writes through.
 * @param hooks - Optional real-world wiring (e.g. attaching the signal handler to a watch session).
 * @returns The process exit code: `0` success (or `--help`/`--version`); `1` `translate`/`import`
 *   finished but some locales failed, or `check`/`diff` found drift/pending changes; `2` could not run
 *   (a whole-run `SdkError`, a CLI usage error, or a commander usage error); `130` `watch` or `studio`
 *   force-stopped by a second interrupt.
 * @throws Re-throws a non-`CommanderError` thrown during parsing; commander usage errors are mapped to
 *   an exit code, not thrown.
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
      return error.exitCode === 0 ? 0 : 2;
    }
    throw error;
  }
  return code;
}
