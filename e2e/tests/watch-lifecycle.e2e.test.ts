import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  type EnvelopeStream,
  type JsonEnvelope,
  makeConsumer,
  readEnvelopeStream,
  type Subprocess,
  spawnVerbatra,
  writeFileIn,
  writeJsonIn,
} from "../src/harness.js";
import type { WatchLocaleSummary, WatchRunSummary } from "../src/watch-outcome.js";

/**
 * The watch lifecycle, proven without a provider key or a network call, so it can be a required
 * release gate.
 *
 * The keyless watch coverage next to this one drives the interrupt contract off a run that fails at
 * provider construction. That leaves the two things watch actually exists to do unproven by any
 * deterministic test: perform a successful run, and perform another one when the source changes.
 * Both were only ever covered by the live tier, which a provider rate limit can take out, so a watch
 * that stopped reacting to source changes could have reached npm behind a red-for-quota live run.
 *
 * The trick that makes it keyless is that a run with nothing to translate never calls the provider.
 * The project starts already in sync, and the source change adds a key that the target locale
 * already carries: with no lock baseline for it yet, it diffs as unchanged. So the run is real (the
 * source is read, the diff is taken, the summary is written) but no provider request is made. The
 * configured provider points at a closed loopback port, so if a call were ever attempted it would be
 * refused rather than reaching anyone, and it would show up as a withheld key, which every
 * assertion here forbids.
 */

const SOURCE_FILE = "locales/en.json";
const TARGET_FILE = "locales/de.json";

/** A run reports as soon as it completes, so overrunning this means watch is hung or never fired. */
const RUN_RECORD_TIMEOUT_MS = 30_000;

/**
 * A syntactically valid provider that cannot reach anything: port 1 on loopback refuses connections.
 * No key is involved, since openai-compatible falls back to a fixed, non-secret placeholder.
 */
const UNREACHABLE_PROVIDER =
  '{ id: "openai-compatible", options: { baseUrl: "http://127.0.0.1:1", model: "e2e-unreachable", maxOutputTokens: 256 } }';

/** Reads one watch record and asserts it is a successful run carrying `locale`'s summary. */
function expectLocaleSummary(
  envelope: JsonEnvelope<WatchRunSummary>,
  locale: string,
): WatchLocaleSummary {
  if (!envelope.ok) {
    throw new Error(`Expected a successful watch run, got ${envelope.code}: ${envelope.message}`);
  }
  const summary = (envelope.result.locales ?? []).find((entry) => entry.locale === locale);
  if (summary === undefined) {
    throw new Error(`Expected the run to report locale "${locale}"`);
  }
  return summary;
}

/** Asserts a run completed cleanly with nothing withheld, which also proves no provider was reached. */
function expectNothingWithheld(summary: WatchLocaleSummary): void {
  expect(summary.status).toBe("succeeded");
  expect(summary.providerFailures ?? []).toEqual([]);
  expect(summary.integrityMismatches ?? []).toEqual([]);
}

describe("watch lifecycle (no provider key, no network)", () => {
  let consumer: Consumer;

  beforeAll(async () => {
    consumer = await makeConsumer();
  }, 180_000);

  it("runs successfully on startup, runs again when the source changes, and exits 0 on interrupt", async () => {
    const dir = join(consumer.dir, "watch-lifecycle");
    await mkdir(dir, { recursive: true });
    await writeJsonIn(dir, SOURCE_FILE, { greeting: "Hello {{name}}" });
    await writeJsonIn(dir, TARGET_FILE, { greeting: "Hallo {{name}}" });
    await writeFileIn(
      dir,
      "verbatra.config.ts",
      `import { defineConfig } from "@verbatra/cli";\n\nexport default defineConfig({\n  sourceLocale: "en",\n  targetLocales: ["de"],\n  format: "i18next-json",\n  files: { pattern: "locales/{locale}.json" },\n  provider: ${UNREACHABLE_PROVIDER},\n});\n`,
    );

    const watcher: Subprocess = spawnVerbatra(consumer, ["watch", "--json", "--cwd", dir], {});
    const stream: EnvelopeStream<WatchRunSummary> = readEnvelopeStream(watcher);

    try {
      const startup = expectLocaleSummary(
        await stream.next({ timeoutMs: RUN_RECORD_TIMEOUT_MS }),
        "de",
      );
      expectNothingWithheld(startup);
      expect(startup.unchanged ?? []).toContain("greeting");

      // The target gains the key first, so the source write is the only watched event and the run it
      // triggers already sees a target that needs no provider call.
      await writeJsonIn(dir, TARGET_FILE, {
        greeting: "Hallo {{name}}",
        farewell: "Auf Wiedersehen",
      });
      await writeJsonIn(dir, SOURCE_FILE, { greeting: "Hello {{name}}", farewell: "Goodbye" });

      const afterChange = expectLocaleSummary(
        await stream.next({ timeoutMs: RUN_RECORD_TIMEOUT_MS }),
        "de",
      );
      expectNothingWithheld(afterChange);
      expect(afterChange.unchanged ?? []).toContain("farewell");

      watcher.kill("SIGINT");
      const result = await watcher;
      expect(result.signal).toBeUndefined();
      expect(result.exitCode).toBe(0);
    } finally {
      watcher.kill("SIGKILL");
    }
  }, 90_000);
});
