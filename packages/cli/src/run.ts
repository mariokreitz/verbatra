import { Command, CommanderError } from "commander";
import { renderError, renderHuman, renderJson, toRenderableError } from "./render.js";
import type { CliDeps, RunHooks, Streams } from "./types.js";
import { runWatch } from "./watch-session.js";

// Mirrors package.json. A bin is unpublished at 0.0.0; --version content is not load-bearing.
const CLI_VERSION = "0.0.0";

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

/** loadConfig options from the shared flags: explicit file via configPath, search root via cwd. */
function loadOptions(opts: SharedOpts): { cwd?: string; configPath?: string } {
  return {
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
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
  const cwd = opts.cwd;
  let config: Awaited<ReturnType<CliDeps["loadConfig"]>>;
  try {
    config = await deps.loadConfig(loadOptions(opts));
    const summary = await deps.translate({
      config,
      ...(cwd !== undefined ? { cwd } : {}),
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
  let config: Awaited<ReturnType<CliDeps["loadConfig"]>>;
  try {
    config = await deps.loadConfig(loadOptions(opts));
  } catch (error) {
    streams.err(`${renderError(toRenderableError(error))}\n`);
    return 2;
  }
  const debounceMs = parseDebounce(opts.debounce);
  const session = runWatch(
    {
      config,
      json: opts.json === true,
      ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
      ...(debounceMs !== undefined ? { debounceMs } : {}),
    },
    deps,
    streams,
  );
  hooks.onWatchSession?.(session);
  return session.done;
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
    .description("Automate i18n translations: a thin CLI over the verbatra SDK")
    .version(CLI_VERSION)
    .exitOverride()
    .configureOutput({ writeOut: (s) => streams.out(s), writeErr: (s) => streams.err(s) });

  program
    .command("translate")
    .description("Run the one-shot translation flow once and exit")
    .option("--cwd <path>", "directory to resolve config and locale files against")
    .option("--config <path>", "load an explicit config file instead of searching")
    .option("--dry-run", "report what would change without calling a provider or writing")
    .option("--json", "emit the run summary as JSON on stdout")
    .action(async (opts: TranslateOpts) => {
      setCode(await runTranslate(opts, deps, streams));
    });

  program
    .command("watch")
    .description("Watch the source and re-translate on each change until interrupted")
    .option("--cwd <path>", "directory to resolve config and locale files against")
    .option("--config <path>", "load an explicit config file instead of searching")
    .option("--debounce <ms>", "debounce window in milliseconds (default 300)")
    .option("--json", "emit each run as one NDJSON record on stdout")
    .action(async (opts: WatchOpts) => {
      setCode(await runWatchCommand(opts, deps, streams, hooks));
    });

  return program;
}

/**
 * The CLI core: parse argv, dispatch to one SDK entry point, render, and RETURN an exit code. It
 * never calls process.exit and never touches process streams — the bin shim wires those. Usage
 * errors (commander) map to 2; --help/--version exit 0.
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
