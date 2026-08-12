import type { ExchangeFormat, LockWaitEvent, ProgressEvent, TranslateInput } from "@verbatra/sdk";
import { Command, CommanderError } from "commander";
import { z } from "zod";
import { CliUsageError } from "./cli-usage-error.js";
import { loadEnvFiles } from "./env.js";
import { appendMissingGitignoreEntries } from "./gitignore.js";
import { runInit } from "./init.js";
import { renderErrorEnvelope, renderSuccessEnvelope } from "./json-envelope.js";
import { readPackageManifest } from "./package-manifest.js";
import { parsePositiveIntegerOption } from "./positive-integer-option.js";
import {
  renderCheckHuman,
  renderDiffHuman,
  renderError,
  renderExportHuman,
  renderHuman,
  renderLockWait,
  renderProgress,
  toRenderableError,
} from "./render.js";
import { runStudio } from "./studio-command.js";
import type { CliDeps, InitOpts, RunHooks, Streams } from "./types.js";
import { runWatch } from "./watch-session.js";

const CLI_VERSION = readPackageManifest().version;

interface SharedOpts {
  readonly cwd?: string;
  readonly config?: string;
}

/** A comma-separated locale list normalized to an array of trimmed non-empty entries (or left omitted). */
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

/** The cwd/config/json trio every command option schema accepts; every other schema `.extend()`s it. */
const sharedCommandOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  json: z.boolean().optional(),
});

const translateOptsSchema = sharedCommandOptsSchema.extend({
  dryRun: z.boolean().optional(),
  prune: z.boolean().optional(),
  lockTimeout: z.string().optional(),
  concurrency: z.string().optional(),
  cache: z.boolean().optional(),
});

const watchOptsSchema = sharedCommandOptsSchema.extend({
  debounce: z.string().optional(),
  lockTimeout: z.string().optional(),
  concurrency: z.string().optional(),
  cache: z.boolean().optional(),
});
type WatchOpts = z.infer<typeof watchOptsSchema>;

/**
 * The interchange format flag shared by export and import; omitted means the xlsx workbook. It is
 * accepted here as a plain optional string and narrowed by {@link parseExchangeFormat}, so an
 * unsupported value is a {@link CliUsageError} with a readable sentence rather than a raw `ZodError`
 * rendered at the user.
 */
const exchangeFormatSchema = z.string().optional();

const exportOptsSchema = sharedCommandOptsSchema.extend({
  out: z.string().optional(),
  locales: localeListSchema,
  includeUnchanged: z.boolean().optional(),
  format: exchangeFormatSchema,
});

const importOptsSchema = sharedCommandOptsSchema.extend({
  dryRun: z.boolean().optional(),
  format: exchangeFormatSchema,
});

const checkOptsSchema = sharedCommandOptsSchema.extend({
  locales: localeListSchema,
});

const diffOptsSchema = sharedCommandOptsSchema.extend({
  locales: localeListSchema,
});

/**
 * Everything the shared failure scaffolds need to report an error: where to write it, which
 * subcommand produced it, and whether the run is in `--json` mode. Built once per command
 * invocation by {@link commandContext}, before the options are validated, so a failure in the
 * parse step is reported with the same context a failure in the run body is.
 */
interface CommandContext {
  /** The stdout/stderr sink. */
  readonly streams: Streams;
  /** The subcommand name; `null` only when a failure precedes subcommand resolution. */
  readonly command: string | null;
  /** Whether `--json` is in force for this invocation. */
  readonly json: boolean;
}

/**
 * The `--json` flag alone, read off the raw commander options. Every command's own schema also
 * declares `json`, but that schema is what may fail: this minimal parse runs first so a run whose
 * options are rejected still knows it owes the caller a JSON envelope. Unknown keys are stripped
 * rather than rejected, so the full commander option object parses cleanly here.
 */
const jsonFlagSchema = z.object({ json: z.boolean().optional() });

/**
 * Builds the {@link CommandContext} for one invocation.
 *
 * @param command - The subcommand name, a compile-time constant at each call site.
 * @param rawOpts - The unvalidated commander options, read only for `--json`.
 * @param streams - The stdout/stderr sink.
 */
function commandContext(command: string, rawOpts: unknown, streams: Streams): CommandContext {
  const parsed = jsonFlagSchema.safeParse(rawOpts);
  return { streams, command, json: parsed.success && parsed.data.json === true };
}

/**
 * Reports a caught error and returns exit `2`.
 *
 * The human-readable line goes to stderr in both modes, unchanged, so an exit-code-plus-stderr
 * consumer sees exactly what it always did. Under `--json` the same structured projection is also
 * written to stdout as one error envelope, giving a machine consumer something to parse where it
 * previously got an empty stream and a bare exit code. Both carry the identical secret-free
 * `{ code, message }`, so the envelope can leak nothing the stderr line would not have leaked.
 */
function renderFailureExit2(error: unknown, context: CommandContext): number {
  const renderable = toRenderableError(error);
  context.streams.err(`${renderError(renderable)}\n`);
  if (context.json) {
    context.streams.out(`${renderErrorEnvelope(context.command, renderable)}\n`);
  }
  return 2;
}

/** The stable code carried by the error envelope for a commander usage failure. */
const USAGE_ERROR_CODE = "USAGE_ERROR";

/** True when raw argv asks for `--json`, read before commander could parse anything. */
function argvRequestsJson(argv: readonly string[]): boolean {
  return argv.includes("--json");
}

/**
 * The subcommand named in raw argv, or `null` when none of the program's commands appears in it.
 * Read from argv rather than from a parsed result because a usage error can happen before commander
 * resolves a command at all, which is exactly the case {@link ErrorEnvelope.command}'s `null` is for.
 */
function resolveCommandName(program: Command, argv: readonly string[]): string | null {
  const names = new Set(program.commands.map((command) => command.name()));
  return argv.find((token) => names.has(token)) ?? null;
}

/**
 * Reports a commander usage failure (an unknown option, a missing required argument, an unknown
 * command) and returns exit `2`.
 *
 * Commander has already written its own human-readable line to stderr through the configured
 * output, so this adds nothing there. Under `--json` it writes the one error envelope the contract
 * promises for a whole-run failure, which this is: without it a `--json` consumer piping stdout got
 * an empty stream and a bare exit code, the very gap the envelope exists to close. `--json` and the
 * command name are recovered from raw argv, since the failure happened before commander produced a
 * parsed result; an unknown command yields `null`, the documented no-command-resolved case.
 */
function renderUsageFailureExit2(
  error: CommanderError,
  program: Command,
  argv: readonly string[],
  streams: Streams,
): number {
  if (argvRequestsJson(argv)) {
    const envelope = renderErrorEnvelope(resolveCommandName(program, argv), {
      code: USAGE_ERROR_CODE,
      message: error.message,
    });
    streams.out(`${envelope}\n`);
  }
  return 2;
}

/**
 * Runs a synchronous option-parsing step inside a try that reports any parse or usage failure and
 * returns exit `2`. On success the parsed options are handed to `body`. This is the single copy of
 * the parse/render/return-2 wiring shared by every command's option parsing.
 */
async function withParsedOpts<T>(
  parse: () => T,
  context: CommandContext,
  body: (opts: T) => Promise<number>,
): Promise<number> {
  let opts: T;
  try {
    opts = parse();
  } catch (error) {
    return renderFailureExit2(error, context);
  }
  return body(opts);
}

/**
 * Parses a locale command's options and rejects a provided-but-empty `--locales` list. `localeListSchema`
 * normalizes `""` and `","` to an empty array (defined, not undefined), which would otherwise select no
 * locales and let a CI drift gate exit 0. An omitted flag stays `undefined` and is allowed.
 *
 * @throws {@link CliUsageError} `INVALID_LOCALES` when `locales` is provided but lists no locale.
 */
function parseLocaleCommandOpts<T extends { readonly locales?: readonly string[] | undefined }>(
  schema: z.ZodType<T>,
  rawOpts: unknown,
): T {
  const opts = schema.parse(rawOpts);
  if (opts.locales !== undefined && opts.locales.length === 0) {
    throw new CliUsageError(
      "INVALID_LOCALES",
      "The --locales option was provided but lists no locale. Pass a comma-separated list of " +
        "configured target locales, or omit --locales to use all of them.",
    );
  }
  return opts;
}

/**
 * Parses a locale command's options inside the shared parse/render/return-2 scaffold. On success the
 * parsed options are handed to `body`. Used by `check`, `diff`, and `export`.
 */
async function withLocaleOpts<T extends { readonly locales?: readonly string[] | undefined }>(
  schema: z.ZodType<T>,
  rawOpts: unknown,
  context: CommandContext,
  body: (opts: T) => Promise<number>,
): Promise<number> {
  return withParsedOpts(() => parseLocaleCommandOpts(schema, rawOpts), context, body);
}

function loadOptions(opts: SharedOpts, cwd: string): { cwd: string; configPath?: string } {
  return {
    cwd,
    ...(opts.config !== undefined ? { configPath: opts.config } : {}),
  };
}

/**
 * Shared whole-run error scaffold for the one-shot commands: run `beforeLoad` (if given), load the
 * config, then run the body, all in one try, mapping any thrown error through
 * {@link renderFailureExit2} to exit `2`. A `1` comes only from a body that returns it without
 * throwing. The `await` on `body` is load-bearing: returning it unawaited would let a rejection
 * escape this try as an unhandled rejection.
 *
 * @param beforeLoad - An optional step (e.g. loading `.env` files) run before `loadConfig`, inside the
 *   same try, so a non-ENOENT read error is rendered structurally instead of escaping unhandled.
 */
async function withWholeRunErrors(
  deps: CliDeps,
  context: CommandContext,
  loadOpts: { cwd: string; configPath?: string },
  body: (config: Awaited<ReturnType<CliDeps["loadConfig"]>>) => Promise<number>,
  beforeLoad?: () => void,
): Promise<number> {
  try {
    beforeLoad?.();
    const config = await deps.loadConfig(loadOpts);
    return await body(config);
  } catch (error) {
    return renderFailureExit2(error, context);
  }
}

/**
 * Parses `--debounce` into milliseconds. An omitted flag stays `undefined` (watch applies its own
 * 300ms default). A given value must be a bare positive integer string; anything else (non-numeric,
 * zero, negative, or a unit suffix like "250ms") is a usage error, never a silent fallback to the
 * default.
 *
 * @throws {@link CliUsageError} `INVALID_DEBOUNCE` when `value` is not a positive integer string.
 */
function parseDebounce(value: string | undefined): number | undefined {
  return parsePositiveIntegerOption(value, {
    code: "INVALID_DEBOUNCE",
    describe: "--debounce option must be a positive whole number of milliseconds",
    min: 1,
  });
}

/** The handoff formats `export` and `import` accept, in the order the help text lists them. */
const EXCHANGE_FORMATS: readonly ExchangeFormat[] = ["xlsx", "csv", "tsv"];

/**
 * Narrows `--format` to a supported handoff format. An omitted flag stays `undefined`, leaving the
 * SDK's own `xlsx` default in force. Any other value is a usage error, checked in the parse step so
 * the user reads one plain sentence instead of a schema dump.
 *
 * @throws {@link CliUsageError} `INVALID_FORMAT` when `value` is not a supported handoff format.
 */
function parseExchangeFormat(value: string | undefined): ExchangeFormat | undefined {
  if (value === undefined) {
    return undefined;
  }
  const format = EXCHANGE_FORMATS.find((candidate) => candidate === value);
  if (format === undefined) {
    throw new CliUsageError(
      "INVALID_FORMAT",
      `The --format option must be one of ${EXCHANGE_FORMATS.join(", ")}, got "${value}".`,
    );
  }
  return format;
}

/**
 * Parses `--lock-timeout` (a whole number of seconds) into milliseconds. An omitted flag stays
 * `undefined` (the SDK applies the lock's own 10-minute default). A given value must be a bare positive
 * integer string; anything else (non-numeric, zero, negative, or a suffix like "60s") is a usage error,
 * never a silent fallback to the default.
 *
 * @throws {@link CliUsageError} `INVALID_LOCK_TIMEOUT` when `value` is not a positive integer string.
 */
function parseLockTimeout(value: string | undefined): number | undefined {
  const seconds = parsePositiveIntegerOption(value, {
    code: "INVALID_LOCK_TIMEOUT",
    describe: "--lock-timeout option must be a positive whole number of seconds",
    min: 1,
  });
  return seconds === undefined ? undefined : seconds * 1000;
}

/**
 * Parses `--concurrency` (how many locales run at once) into a positive integer. An omitted flag
 * stays `undefined` (the SDK applies its default of 1). A given value must be a bare positive integer
 * string; anything else (non-numeric, zero, negative, or a decimal) is a usage error, never a silent
 * fallback to the default.
 *
 * @throws {@link CliUsageError} `INVALID_CONCURRENCY` when `value` is not a positive integer string.
 */
function parseConcurrency(value: string | undefined): number | undefined {
  return parsePositiveIntegerOption(value, {
    code: "INVALID_CONCURRENCY",
    describe: "--concurrency option must be a positive whole number",
    min: 1,
  });
}

/** `translateOptsSchema`'s shape plus the lock timeout and concurrency already parsed to numbers. */
interface ParsedTranslateOpts extends z.infer<typeof translateOptsSchema> {
  readonly lockAcquireTimeoutMs?: number;
  readonly concurrencyValue?: number;
}

/**
 * Parses and validates the `translate` command's options: the zod schema shape, then `--lock-timeout`
 * and `--concurrency` on top, so a single {@link withParsedOpts} call covers any failure.
 */
function parseTranslateCommandOpts(rawOpts: unknown): ParsedTranslateOpts {
  const opts = translateOptsSchema.parse(rawOpts);
  const lockAcquireTimeoutMs = parseLockTimeout(opts.lockTimeout);
  const concurrencyValue = parseConcurrency(opts.concurrency);
  return {
    ...opts,
    ...(lockAcquireTimeoutMs !== undefined ? { lockAcquireTimeoutMs } : {}),
    ...(concurrencyValue !== undefined ? { concurrencyValue } : {}),
  };
}

/**
 * Builds the `onLockWait` callback the CLI hands to a run: it renders each wait-progress event to
 * stderr, never stdout, so a `--json` run's stdout (the run summary or NDJSON stream) is never
 * corrupted by progress output.
 */
function lockWaitReporter(streams: Streams, json: boolean): (event: LockWaitEvent) => void {
  return (event) => {
    streams.err(`${renderLockWait(event, json)}\n`);
  };
}

/**
 * Builds the `onProgress` callback the CLI hands to a run: it renders each progress event to stderr,
 * never stdout, so a `--json` run's stdout (the run summary or NDJSON stream) is never corrupted by
 * progress output. Mirrors {@link lockWaitReporter}.
 */
function progressReporter(streams: Streams, json: boolean): (event: ProgressEvent) => void {
  return (event) => {
    streams.err(`${renderProgress(event, json)}\n`);
  };
}

/**
 * Assembles the {@link TranslateInput} for one `translate` run: the resolved config and cwd, the
 * stderr progress reporters, and every optional flag conditionally spread so an unset flag stays
 * absent (for `exactOptionalPropertyTypes`). Extracted from the run body to keep that body's
 * cognitive complexity within budget.
 */
function buildTranslateInput(
  opts: ParsedTranslateOpts,
  config: TranslateInput["config"],
  cwd: string,
  streams: Streams,
): TranslateInput {
  const json = opts.json === true;
  return {
    config,
    cwd,
    onLockWait: lockWaitReporter(streams, json),
    onProgress: progressReporter(streams, json),
    ...(opts.dryRun === true ? { dryRun: true } : {}),
    ...(opts.prune === true ? { prune: true } : {}),
    ...(opts.lockAcquireTimeoutMs !== undefined
      ? { lockAcquireTimeoutMs: opts.lockAcquireTimeoutMs }
      : {}),
    ...(opts.concurrencyValue !== undefined ? { concurrency: opts.concurrencyValue } : {}),
    ...(opts.cache === false ? { cache: false } : {}),
  };
}

/**
 * Runs the `translate` command. Exported so a test can call it directly with a malformed `rawOpts`
 * object: every field on `translateOptsSchema` is an optional string or boolean, which real commander
 * argv always produces correctly, so no CLI flag can organically trigger a `ZodError` for this command.
 */
export async function runTranslate(
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
): Promise<number> {
  const context = commandContext("translate", rawOpts, streams);
  return withParsedOpts(
    () => parseTranslateCommandOpts(rawOpts),
    context,
    async (opts) => {
      const cwd = opts.cwd ?? process.cwd();
      appendMissingGitignoreEntries(cwd, opts.dryRun);
      return withWholeRunErrors(
        deps,
        context,
        loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
        async (config) => {
          const summary = await deps.translate(buildTranslateInput(opts, config, cwd, streams));
          streams.out(
            context.json
              ? `${renderSuccessEnvelope("translate", summary)}\n`
              : `${renderHuman(summary)}\n`,
          );
          return summary.failed.length > 0 ? 1 : 0;
        },
        () => loadEnvFiles(cwd),
      );
    },
  );
}

/** `watchOptsSchema`'s shape plus the debounce, lock-timeout, and concurrency values already parsed. */
interface ParsedWatchOpts extends WatchOpts {
  readonly debounceMs?: number;
  readonly lockAcquireTimeoutMs?: number;
  readonly concurrencyValue?: number;
}

/**
 * Parses and validates the `watch` command's options: the zod schema shape, then `--debounce`,
 * `--lock-timeout`, and `--concurrency` on top. All run here so a single {@link withParsedOpts} call
 * covers any failure.
 */
function parseWatchCommandOpts(rawOpts: unknown): ParsedWatchOpts {
  const opts = watchOptsSchema.parse(rawOpts);
  const debounceMs = parseDebounce(opts.debounce);
  const lockAcquireTimeoutMs = parseLockTimeout(opts.lockTimeout);
  const concurrencyValue = parseConcurrency(opts.concurrency);
  return {
    ...opts,
    ...(debounceMs !== undefined ? { debounceMs } : {}),
    ...(lockAcquireTimeoutMs !== undefined ? { lockAcquireTimeoutMs } : {}),
    ...(concurrencyValue !== undefined ? { concurrencyValue } : {}),
  };
}

async function runWatchCommand(
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
  hooks: RunHooks,
): Promise<number> {
  const context = commandContext("watch", rawOpts, streams);
  return withParsedOpts(
    () => parseWatchCommandOpts(rawOpts),
    context,
    async (opts) => {
      const cwd = opts.cwd ?? process.cwd();
      appendMissingGitignoreEntries(cwd);
      let config: Awaited<ReturnType<CliDeps["loadConfig"]>>;
      try {
        loadEnvFiles(cwd);
        config = await deps.loadConfig(
          loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
        );
      } catch (error) {
        return renderFailureExit2(error, context);
      }
      const session = runWatch(
        {
          config,
          json: context.json,
          cwd,
          ...(opts.debounceMs !== undefined ? { debounceMs: opts.debounceMs } : {}),
          ...(opts.lockAcquireTimeoutMs !== undefined
            ? { lockAcquireTimeoutMs: opts.lockAcquireTimeoutMs }
            : {}),
          ...(opts.concurrencyValue !== undefined ? { concurrency: opts.concurrencyValue } : {}),
          ...(opts.cache === false ? { cache: false } : {}),
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
 * Runs the `studio` command: starts Verbatra Studio. `runStudio` resolves once startup either succeeds
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
 * Runs the `export` command. Returns `0` on success and `2` when the run could not start. Export has
 * no per-locale failure mode, so it never returns `1`.
 */
async function runExport(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<number> {
  const context = commandContext("export", rawOpts, streams);
  return withParsedOpts(
    () => {
      const opts = parseLocaleCommandOpts(exportOptsSchema, rawOpts);
      return { ...opts, format: parseExchangeFormat(opts.format) };
    },
    context,
    async (opts) => {
      const cwd = opts.cwd ?? process.cwd();
      return withWholeRunErrors(
        deps,
        context,
        loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
        async (config) => {
          const result = await deps.exportWorkbook({
            config,
            cwd,
            ...(opts.out !== undefined ? { out: opts.out } : {}),
            ...(opts.locales !== undefined ? { locales: opts.locales } : {}),
            ...(opts.includeUnchanged === true ? { includeUnchanged: true } : {}),
            ...(opts.format !== undefined ? { format: opts.format } : {}),
          });
          streams.out(
            context.json
              ? `${renderSuccessEnvelope("export", result)}\n`
              : `${renderExportHuman(result)}\n`,
          );
          return 0;
        },
      );
    },
  );
}

/**
 * Runs the `import` command. Exit codes match `translate`: `0` all locales succeeded, `1` a locale
 * failed, `2` the run could not start. Exported for the same reason as {@link runTranslate}: every
 * field on `importOptsSchema` is an optional string or boolean, and the one value with a closed set,
 * `--format`, is narrowed afterwards by {@link parseExchangeFormat} as a {@link CliUsageError} rather
 * than by the schema, so no CLI flag can organically trigger a `ZodError`; a test calls this directly
 * with a malformed `rawOpts` instead.
 */
export async function runImport(
  workbook: string,
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
): Promise<number> {
  const context = commandContext("import", rawOpts, streams);
  return withParsedOpts(
    () => {
      const opts = importOptsSchema.parse(rawOpts);
      return { ...opts, format: parseExchangeFormat(opts.format) };
    },
    context,
    async (opts) => {
      const cwd = opts.cwd ?? process.cwd();
      appendMissingGitignoreEntries(cwd, opts.dryRun);
      return withWholeRunErrors(
        deps,
        context,
        loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
        async (config) => {
          const summary = await deps.importWorkbook({
            config,
            workbook,
            cwd,
            ...(opts.dryRun === true ? { dryRun: true } : {}),
            ...(opts.format !== undefined ? { format: opts.format } : {}),
          });
          streams.out(
            context.json
              ? `${renderSuccessEnvelope("import", summary)}\n`
              : `${renderHuman(summary, "import")}\n`,
          );
          return summary.failed.length > 0 ? 1 : 0;
        },
      );
    },
  );
}

/**
 * Runs the read-only `check` command. Exit codes: `0` every locale in sync, `1` at least one locale
 * has a missing or stale key, `2` the run could not start.
 */
async function runCheck(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<number> {
  const context = commandContext("check", rawOpts, streams);
  return withLocaleOpts(checkOptsSchema, rawOpts, context, async (opts) => {
    const cwd = opts.cwd ?? process.cwd();
    return withWholeRunErrors(
      deps,
      context,
      loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
      async (config) => {
        const summary = await deps.check({
          config,
          cwd,
          ...(opts.locales !== undefined ? { locales: opts.locales } : {}),
        });
        streams.out(
          context.json
            ? `${renderSuccessEnvelope("check", summary)}\n`
            : `${renderCheckHuman(summary)}\n`,
        );
        return summary.inSync ? 0 : 1;
      },
    );
  });
}

/**
 * Runs the read-only `diff` command. Exit codes: `0` no pending changes, `1` at least one locale has a
 * missing or changed key (orphaned keys alone never produce `1`), `2` the run could not start.
 */
async function runDiff(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<number> {
  const context = commandContext("diff", rawOpts, streams);
  return withLocaleOpts(diffOptsSchema, rawOpts, context, async (opts) => {
    const cwd = opts.cwd ?? process.cwd();
    return withWholeRunErrors(
      deps,
      context,
      loadOptions(opts.config !== undefined ? { config: opts.config } : {}, cwd),
      async (config) => {
        const summary = await deps.diff({
          config,
          cwd,
          ...(opts.locales !== undefined ? { locales: opts.locales } : {}),
        });
        streams.out(
          context.json
            ? `${renderSuccessEnvelope("diff", summary)}\n`
            : `${renderDiffHuman(summary)}\n`,
        );
        return summary.hasPendingChanges ? 1 : 0;
      },
    );
  });
}

/** Everything a per-command registration function needs: where to dispatch and how to report the exit code. */
interface ProgramContext {
  readonly deps: CliDeps;
  readonly streams: Streams;
  readonly hooks: RunHooks;
  readonly setCode: (code: number) => void;
}

/** Registers `translate`: its flags, help examples, and action wiring. */
function registerTranslateCommand(program: Command, ctx: ProgramContext): void {
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
    .option(
      "--lock-timeout <seconds>",
      "how long to wait for a held per-locale write lock before failing (default 600)",
    )
    .option(
      "--concurrency <n>",
      "how many target locales to translate at once (default 1; not allowed with a maxTokens budget)",
    )
    .option(
      "--no-cache",
      "bypass the local translation-memory cache (verbatra.cache.json) for this run",
    )
    .option("--json", "print the run summary as JSON")
    .action(async (opts: unknown) => {
      ctx.setCode(await runTranslate(opts, ctx.deps, ctx.streams));
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
}

/** Registers `watch`: its flags and action wiring. */
function registerWatchCommand(program: Command, ctx: ProgramContext): void {
  program
    .command("watch")
    .description("Re-translate on every source change until interrupted")
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option(
      "--debounce <ms>",
      "wait this many milliseconds after a change before translating (default 300)",
    )
    .option(
      "--lock-timeout <seconds>",
      "how long to wait for a held per-locale write lock before failing (default 600)",
    )
    .option(
      "--concurrency <n>",
      "how many target locales to translate at once per run (default 1; not allowed with a maxTokens budget)",
    )
    .option(
      "--no-cache",
      "bypass the local translation-memory cache (verbatra.cache.json) on every run",
    )
    .option("--json", "print each run as one NDJSON record")
    .action(async (opts: unknown) => {
      ctx.setCode(await runWatchCommand(opts, ctx.deps, ctx.streams, ctx.hooks));
    });
}

/** Registers `export`: its flags, help examples, and action wiring. */
function registerExportCommand(program: Command, ctx: ProgramContext): void {
  program
    .command("export")
    .description(
      "Export untranslated strings into a translator handoff (Excel workbook, CSV, or TSV)",
    )
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option(
      "--out <path>",
      "write the handoff here: a file for xlsx (default verbatra-translations.xlsx), a directory for csv and tsv (default verbatra-translations)",
    )
    .option("--locales <list>", "comma-separated subset of target locales (default all configured)")
    .option("--include-unchanged", "also export already up-to-date strings (off by default)")
    .option("--format <format>", "handoff format: xlsx (default), csv, or tsv")
    .option("--json", "print the export result as JSON")
    .action(async (opts: unknown) => {
      ctx.setCode(await runExport(opts, ctx.deps, ctx.streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra export                       write the workbook with missing and changed strings",
        "  $ verbatra export --locales de,fr       only the German and French sheets",
        "  $ verbatra export --include-unchanged   include already up-to-date strings",
        "  $ verbatra export --format csv          write one <locale>.csv per locale into a directory",
      ].join("\n"),
    );
}

/** Registers `import`: its argument, flags, help examples, and action wiring. */
function registerImportCommand(program: Command, ctx: ProgramContext): void {
  program
    .command("import")
    .argument(
      "<workbook>",
      "path to the filled handoff: a workbook file, one csv or tsv file, or a directory of them",
    )
    .description(
      "Import a filled handoff back into the locale files, running the same safety checks",
    )
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--dry-run", "validate and report without writing locale files or updating the lock")
    .option("--format <format>", "handoff format: xlsx (default), csv, or tsv")
    .option("--json", "print the run summary as JSON")
    .action(async (workbook: string, opts: unknown) => {
      ctx.setCode(await runImport(workbook, opts, ctx.deps, ctx.streams));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra import translations.xlsx             import the filled workbook",
        "  $ verbatra import translations.xlsx --dry-run   validate and report, write nothing",
        "  $ verbatra import handoff --format csv          import every <locale>.csv in the directory",
      ].join("\n"),
    );
}

/** Registers `check`: its flags, help examples, and action wiring. */
function registerCheckCommand(program: Command, ctx: ProgramContext): void {
  program
    .command("check")
    .description("Report which keys are missing or stale per locale without writing files")
    .option("--cwd <path>", "resolve config and locale files from this directory")
    .option("--config <path>", "load this config file instead of searching for one")
    .option("--locales <list>", "comma-separated subset of target locales (default all configured)")
    .option("--json", "print the check summary as JSON")
    .action(async (opts: unknown) => {
      ctx.setCode(await runCheck(opts, ctx.deps, ctx.streams));
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
}

/** Registers `diff`: its flags, help examples, and action wiring. */
function registerDiffCommand(program: Command, ctx: ProgramContext): void {
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
      ctx.setCode(await runDiff(opts, ctx.deps, ctx.streams));
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
}

/** Registers `studio`: its flags, help examples, and action wiring. */
function registerStudioCommand(program: Command, ctx: ProgramContext): void {
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
    .option(
      "--expose-agent-tools",
      "register Studio's RPC methods as WebMCP agent tools in the browser (also: VERBATRA_STUDIO_AGENT_TOOLS)",
    )
    .action(async (opts: unknown) => {
      ctx.setCode(await runStudioCommand(opts, ctx.deps, ctx.streams, ctx.hooks));
    })
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ verbatra studio                      start Verbatra Studio on the default port",
        "  $ verbatra studio --port 6000          start Verbatra Studio on a specific port",
        "  $ verbatra studio --allow-spend        start Studio with retranslate enabled",
        "  $ verbatra studio --expose-agent-tools start Studio with the WebMCP agent tools enabled",
      ].join("\n"),
    );
}

/** Registers `init`: its flags, help examples, and action wiring. */
function registerInitCommand(program: Command, ctx: ProgramContext): void {
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
      ctx.setCode(await runInit(opts, ctx.streams));
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
}

/** Builds the commander program: every subcommand with its flags, help text, and action wiring. */
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
      "Automate i18n translation and keep your locale files in sync, using a hosted or local AI or machine-translation provider",
    )
    .version(CLI_VERSION)
    .exitOverride()
    .configureOutput({ writeOut: (s) => streams.out(s), writeErr: (s) => streams.err(s) });

  const ctx: ProgramContext = { deps, streams, hooks, setCode };
  registerTranslateCommand(program, ctx);
  registerWatchCommand(program, ctx);
  registerExportCommand(program, ctx);
  registerImportCommand(program, ctx);
  registerCheckCommand(program, ctx);
  registerDiffCommand(program, ctx);
  registerStudioCommand(program, ctx);
  registerInitCommand(program, ctx);

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
 *   finished but some locales failed (produced nothing), or `check`/`diff` found drift/pending
 *   changes; `2` could not run (a whole-run `SdkError`, a CLI usage error, or a commander usage
 *   error); `130` `watch` or `studio` force-stopped by a second interrupt. A `partial` locale (it
 *   wrote translations but withheld some keys, which retry next run) does not fail the run: it is not
 *   in `summary.failed`, so it exits `0`.
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
      return error.exitCode === 0 ? 0 : renderUsageFailureExit2(error, program, argv, streams);
    }
    throw error;
  }
  return code;
}
