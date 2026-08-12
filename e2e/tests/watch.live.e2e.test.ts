import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  delay,
  type EnvelopeStream,
  makeConsumer,
  parseNdjsonEnvelopes,
  providerConfigBlock,
  providerFromEnv,
  readEnvelopeStream,
  readJsonIn,
  type Subprocess,
  spawnVerbatra,
  writeFileIn,
  writeJsonIn,
} from "../src/harness.js";
import {
  classifyWatchEnvelope,
  type SettledKeyOutcome,
  type WatchRunSummary,
  type WatchTarget,
} from "../src/watch-outcome.js";

const provider = providerFromEnv();

/** Relative path of the source locale file, rewritten to retrigger a run. */
const SOURCE_FILE = "locales/en.json";

/**
 * How long one watch run may take to report its outcome. This is a liveness bound, not a wait for a
 * key to eventually show up: a run reports as soon as it completes, so overrunning this means watch
 * is hung or never triggered, which is a real failure.
 */
const RUN_RECORD_TIMEOUT_MS = 60_000;

/** How many times a key is asked for before the provider is judged to be throttling persistently. */
const DELIVERY_ATTEMPTS = 3;

/**
 * Quiet period before a retry. A free-tier rate limit is a short rolling window, so backing off and
 * asking again is what makes this test resilient. Deliberately not a longer single wait: the run
 * that came back rate-limited already answered, and waiting longer for an answer that has already
 * arrived would only make the test slower, never more reliable.
 */
const THROTTLE_BACKOFF_MS = 20_000;

/** Reads records until one says something about `target`, or the run budget is spent. */
async function awaitRunOutcome(
  stream: EnvelopeStream<WatchRunSummary>,
  target: WatchTarget,
): Promise<SettledKeyOutcome> {
  const deadline = Date.now() + RUN_RECORD_TIMEOUT_MS;
  for (;;) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(
        `No watch run reported on "${target.key}" within ${RUN_RECORD_TIMEOUT_MS}ms.`,
      );
    }
    const outcome = classifyWatchEnvelope(await stream.next({ timeoutMs: remainingMs }), target);
    if (outcome.kind !== "pending") {
      return outcome;
    }
  }
}

/** Everything {@link awaitDelivery} needs to ask for a key again after a throttle. */
interface DeliveryRequest {
  readonly stream: EnvelopeStream<WatchRunSummary>;
  readonly target: WatchTarget;
  /** Project directory holding the source file to rewrite. */
  readonly dir: string;
  /** The source content to write back; rewriting it is what retriggers a run. */
  readonly source: Record<string, string>;
  /** Records why an attempt is being retried, so a throttled run is visible in the report. */
  readonly note: (message: string) => Promise<unknown>;
}

/**
 * Waits for `target` to be delivered, retrying through provider throttling.
 *
 * A rate-limited sub-batch is withheld by the SDK and retried on the next run, so the retry here is
 * simply to back off and trigger that next run by rewriting the source file. Any other outcome
 * fails immediately: this retries an environmental condition, never a product fault.
 *
 * @returns `undefined` once the key was delivered, or the last throttle detail when every attempt
 *   was rate-limited.
 */
async function awaitDelivery(request: DeliveryRequest): Promise<string | undefined> {
  let lastThrottle = "the provider rate-limited every attempt";
  for (let attempt = 1; attempt <= DELIVERY_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await delay(THROTTLE_BACKOFF_MS);
      await writeJsonIn(request.dir, SOURCE_FILE, request.source);
    }
    const outcome = await awaitRunOutcome(request.stream, request.target);
    if (outcome.kind === "delivered") {
      return undefined;
    }
    if (outcome.kind === "failed") {
      throw new Error(`watch run failed on "${request.target.key}": ${outcome.detail}`);
    }
    lastThrottle = outcome.detail;
    await request.note(
      `Attempt ${attempt} of ${DELIVERY_ATTEMPTS} for "${request.target.key}" was throttled: ${outcome.detail}`,
    );
  }
  return lastThrottle;
}

describe.skipIf(provider === null)(`watch (live: ${provider?.id ?? "skipped"})`, () => {
  let consumer: Consumer;

  beforeAll(async () => {
    consumer = await makeConsumer();
  }, 180_000);

  /**
   * The test drives the `--json` NDJSON stream rather than polling the locale file, because the file
   * cannot say why a key is missing. Every run reports its own outcome, so a key withheld by a
   * provider rate limit is distinguishable from a key that never arrived because watch is broken.
   * Only the first is retried, and only the first can end in a skip.
   *
   * The shutdown assertions (exit 0 on a single SIGINT, at least one NDJSON record, no secret in
   * either stream) are deterministic and run whether or not the provider cooperated, so a quota
   * skip never costs the suite its coverage of the interrupt contract.
   */
  it("translates on startup and again when the source changes, then stops on interrupt", async (ctx) => {
    if (provider === null) {
      return;
    }
    const dir = join(consumer.dir, "watch-live");
    await mkdir(dir, { recursive: true });
    const initialSource = { greeting: "Hello {{name}}", farewell: "Goodbye" };
    await writeJsonIn(dir, SOURCE_FILE, initialSource);
    await writeJsonIn(dir, "locales/de.json", { greeting: "Hallo {{name}}" });
    await writeFileIn(
      dir,
      "verbatra.config.ts",
      `import { defineConfig } from "@verbatra/cli";\n\nexport default defineConfig({\n  sourceLocale: "en",\n  targetLocales: ["de"],\n  format: "i18next-json",\n  files: { pattern: "locales/{locale}.json" },\n  provider: ${providerConfigBlock(provider)},\n});\n`,
    );

    const watcher: Subprocess = spawnVerbatra(consumer, ["watch", "--json", "--cwd", dir], {
      env: { [provider.envVar]: provider.key },
    });
    const stream = readEnvelopeStream<WatchRunSummary>(watcher);
    const note = (message: string): Promise<unknown> => ctx.annotate(message);
    let throttled: string | undefined;
    let stopResult: Awaited<Subprocess> | undefined;

    try {
      // Startup run: the key missing from the target locale must be filled without any source edit.
      throttled = await awaitDelivery({
        stream,
        target: { locale: "de", key: "farewell" },
        dir,
        source: initialSource,
        note,
      });

      if (throttled === undefined) {
        // Source change: a new key added while watch is running must be picked up.
        const changedSource = { ...initialSource, welcome: "Welcome {{name}}" };
        await writeJsonIn(dir, SOURCE_FILE, changedSource);
        throttled = await awaitDelivery({
          stream,
          target: { locale: "de", key: "welcome" },
          dir,
          source: changedSource,
          note,
        });
      }
    } finally {
      watcher.kill("SIGINT");
      stopResult = await watcher;
    }

    expect(stopResult.signal).toBeUndefined();
    expect(stopResult.exitCode).toBe(0);

    const records = parseNdjsonEnvelopes(stopResult.stdout);
    expect(records.length).toBeGreaterThan(0);

    expect(stopResult.stdout).not.toContain(provider.key);
    expect(stopResult.stderr).not.toContain(provider.key);

    if (throttled !== undefined) {
      ctx.skip(
        `The provider throttled every one of ${DELIVERY_ATTEMPTS} attempts, so the translation half of this test could not run: ${throttled}`,
      );
    }

    const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
    expect((de.farewell ?? "").length).toBeGreaterThan(0);
    expect(de.welcome ?? "").toContain("{{name}}");
    expect(de.greeting ?? "").toContain("{{name}}");
  }, 480_000);
});
