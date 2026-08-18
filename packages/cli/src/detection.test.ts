import type { ProjectDetection, ResolvedProjectConfig } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import { run } from "./run.js";
import { captureStreams, makeConfig, parseEnvelope, recordingDeps } from "./test-support.js";

function makeDetection(overrides: Partial<ProjectDetection> = {}): ProjectDetection {
  return {
    directory: "locales",
    pattern: "locales/{locale}.json",
    format: "i18next-json",
    sourceLocale: "en",
    targetLocales: ["de", "fr"],
    provider: "anthropic",
    providerResolved: true,
    alsoAvailable: [],
    ...overrides,
  };
}

function detected(overrides: Partial<ProjectDetection> = {}): ResolvedProjectConfig {
  return { config: makeConfig(), loaded: undefined, detection: makeDetection(overrides) };
}

const loadedFromFile: ResolvedProjectConfig = {
  config: makeConfig(),
  loaded: undefined,
  detection: undefined,
};

describe("zero-config detection reporting", () => {
  it("tells the user what it detected before running check", async () => {
    const { deps } = recordingDeps({ resolveConfig: async () => detected() });
    const cap = captureStreams();

    const code = await run(["check"], deps, cap.streams);

    expect(code).toBe(0);
    expect(cap.err()).toContain("no config file found");
    expect(cap.err()).toContain("locales/{locale}.json (i18next-json)");
    expect(cap.err()).toContain("en -> de, fr");
    expect(cap.err()).toContain("provider anthropic");
    expect(cap.err()).toContain("verbatra init");
  });

  it("says nothing when a real config was loaded", async () => {
    const { deps } = recordingDeps({ resolveConfig: async () => loadedFromFile });
    const cap = captureStreams();

    await run(["check"], deps, cap.streams);

    expect(cap.err()).toBe("");
  });

  it("reports detection as a JSON line on stderr under --json, leaving stdout an envelope", async () => {
    const { deps } = recordingDeps({ resolveConfig: async () => detected() });
    const cap = captureStreams();

    await run(["diff", "--json"], deps, cap.streams);

    const notice = JSON.parse(cap.err().trim()) as Record<string, unknown>;
    expect(notice.event).toBe("detection");
    expect(notice.format).toBe("i18next-json");
    expect(parseEnvelope(cap.out()).ok).toBe(true);
  });

  it("names the runners-up when several provider keys were set", async () => {
    const { deps } = recordingDeps({
      resolveConfig: async () => detected({ alsoAvailable: ["openai", "deepl"] }),
    });
    const cap = captureStreams();

    await run(["check"], deps, cap.streams);

    expect(cap.err()).toContain("keys were also set for openai, deepl");
  });
});

describe("the provider gate on a detected project", () => {
  const withoutKey = async (): Promise<ResolvedProjectConfig> =>
    detected({ providerResolved: false });

  it("lets check run with no provider API key at all", async () => {
    const { deps, calls } = recordingDeps({ resolveConfig: withoutKey });
    const cap = captureStreams();

    expect(await run(["check"], deps, cap.streams)).toBe(0);
    expect(calls.check).toHaveLength(1);
    expect(cap.err()).toContain("no provider API key found");
  });

  it("lets diff run with no provider API key at all", async () => {
    const { deps, calls } = recordingDeps({ resolveConfig: withoutKey });
    const cap = captureStreams();

    expect(await run(["diff"], deps, cap.streams)).toBe(0);
    expect(calls.diff).toHaveLength(1);
  });

  it("refuses translate with no provider API key, naming every variable", async () => {
    const { deps, calls } = recordingDeps({ resolveConfig: withoutKey });
    const cap = captureStreams();

    expect(await run(["translate"], deps, cap.streams)).toBe(2);
    expect(calls.translate).toHaveLength(0);
    expect(cap.err()).toContain("PROVIDER_KEY_MISSING");
    expect(cap.err()).toContain("ANTHROPIC_API_KEY");
    expect(cap.err()).toContain("DEEPL_API_KEY");
  });

  it("allows a dry-run translate without a key, since it never calls the provider", async () => {
    const { deps, calls } = recordingDeps({ resolveConfig: withoutKey });
    const cap = captureStreams();

    await run(["translate", "--dry-run"], deps, cap.streams);

    expect(calls.translate).toHaveLength(1);
  });

  it("never refuses a command whose config came from a file", async () => {
    const { deps, calls } = recordingDeps({ resolveConfig: async () => loadedFromFile });
    const cap = captureStreams();

    await run(["translate"], deps, cap.streams);

    expect(calls.translate).toHaveLength(1);
  });
});
