import type { DoctorResult } from "@verbatra/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JSON_ENVELOPE_VERSION } from "./json-envelope.js";
import { run } from "./run.js";
import { captureStreams, makeDoctorResult, parseEnvelope, recordingDeps } from "./test-support.js";

const KEY_CANARY = "sk-ant-cli-canary-4a7e2f9b1c6d";

function failingReport(): DoctorResult {
  return makeDoctorResult({
    ok: false,
    checks: [
      {
        id: "config",
        title: "Configuration",
        status: "pass",
        detail: "Loaded /proj/.verbatrarc.json.",
      },
      {
        id: "format-adapter",
        title: "Format adapter",
        status: "pass",
        detail: 'Format "i18next-json" resolves to an adapter.',
      },
      {
        id: "provider",
        title: "Provider",
        status: "pass",
        detail: 'Provider "anthropic" resolves to a factory.',
      },
      {
        id: "api-key",
        title: "API key environment variable",
        status: "fail",
        detail: "The ANTHROPIC_API_KEY environment variable is not set.",
      },
      {
        id: "source-file",
        title: "Source locale file",
        status: "fail",
        detail: "The source locale file was not found at /proj/locales/en.json.",
      },
    ],
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("run doctor: SDK delegation, rendering, and exit codes", () => {
  it("delegates to doctor with the resolved cwd and exits 0 on a clean project", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["doctor", "--cwd", "/proj"], deps, cap.streams);

    expect(code).toBe(0);
    expect(calls.doctor).toEqual([{ cwd: "/proj" }]);
    expect(cap.out()).toContain("verbatra doctor");
    expect(cap.out()).toContain("[ok  ] Configuration: Loaded /proj/verbatra.config.ts.");
    expect(cap.out()).toContain("no problems found");
  });

  it("loads the config inside the SDK flow, never through the CLI loadConfig dependency", async () => {
    const { deps, calls } = recordingDeps();

    await run(["doctor", "--cwd", "/proj"], deps, captureStreams().streams);

    expect(calls.loadConfig).toEqual([]);
    expect(calls.loadConfigWithMeta).toEqual([]);
  });

  it("exits 1 and still prints every failing check when the project has problems", async () => {
    const { deps } = recordingDeps({ doctor: async () => failingReport() });
    const cap = captureStreams();

    const code = await run(["doctor"], deps, cap.streams);

    expect(code).toBe(1);
    expect(cap.out()).toContain(
      "[fail] API key environment variable: The ANTHROPIC_API_KEY environment variable is not set.",
    );
    expect(cap.out()).toContain(
      "[fail] Source locale file: The source locale file was not found at /proj/locales/en.json.",
    );
    expect(cap.out()).toContain("2 problems found");
  });

  it("counts a single problem in the singular", async () => {
    const report = failingReport();
    const { deps } = recordingDeps({
      doctor: async () => ({
        ok: false,
        checks: report.checks.filter((entry) => entry.id !== "source-file"),
      }),
    });
    const cap = captureStreams();

    expect(await run(["doctor"], deps, cap.streams)).toBe(1);
    expect(cap.out()).toContain("1 problem found");
  });

  it("renders skipped checks distinctly from failed ones", async () => {
    const { deps } = recordingDeps({
      doctor: async () => ({
        ok: false,
        checks: [
          {
            id: "config",
            title: "Configuration",
            status: "fail",
            detail: "No verbatra configuration found.",
          },
          {
            id: "provider",
            title: "Provider",
            status: "skipped",
            detail: "Not checked: the configuration could not be loaded.",
          },
        ],
      }),
    });
    const cap = captureStreams();

    expect(await run(["doctor"], deps, cap.streams)).toBe(1);
    expect(cap.out()).toContain("[fail] Configuration: No verbatra configuration found.");
    expect(cap.out()).toContain("[skip] Provider: Not checked");
    expect(cap.out()).toContain("1 problem found");
  });

  it("--json prints one success envelope carrying the per-check verdicts, and still exits 1", async () => {
    const report = failingReport();
    const { deps } = recordingDeps({ doctor: async () => report });
    const cap = captureStreams();

    const code = await run(["doctor", "--json"], deps, cap.streams);

    expect(code).toBe(1);
    expect(parseEnvelope(cap.out())).toEqual({
      ok: true,
      version: JSON_ENVELOPE_VERSION,
      command: "doctor",
      result: report,
    });
    expect(cap.err()).toBe("");
  });

  it("forwards --config as configPath", async () => {
    const { deps, calls } = recordingDeps();

    await run(
      ["doctor", "--cwd", "/proj", "--config", "custom.json"],
      deps,
      captureStreams().streams,
    );

    expect(calls.doctor).toEqual([{ cwd: "/proj", configPath: "custom.json" }]);
  });

  it("a thrown SDK error renders to stderr and exits 2 with clean stdout", async () => {
    const { deps } = recordingDeps({
      doctor: async () => {
        throw Object.assign(new Error("No verbatra configuration file at /proj/nope.json."), {
          code: "CONFIG_NOT_FOUND",
        });
      },
    });
    const cap = captureStreams();

    const code = await run(["doctor", "--config", "nope.json"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[CONFIG_NOT_FOUND]");
    expect(cap.out()).toBe("");
  });

  it("emits an error envelope on stdout for an exit-2 failure under --json", async () => {
    const { deps } = recordingDeps({
      doctor: async () => {
        throw Object.assign(new Error("No verbatra configuration file at /proj/nope.json."), {
          code: "CONFIG_NOT_FOUND",
        });
      },
    });
    const cap = captureStreams();

    const code = await run(["doctor", "--config", "nope.json", "--json"], deps, cap.streams);

    expect(code).toBe(2);
    expect(parseEnvelope(cap.out())).toMatchObject({
      ok: false,
      command: "doctor",
      code: "CONFIG_NOT_FOUND",
    });
  });

  it("rejects an unknown flag as a usage error without calling the SDK", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["doctor", "--locales", "de"], deps, cap.streams);

    expect(code).toBe(2);
    expect(calls.doctor).toEqual([]);
  });

  it("never prints an API key value on stdout or stderr, even with one set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", KEY_CANARY);
    const { deps } = recordingDeps({ doctor: async () => failingReport() });
    const cap = captureStreams();

    await run(["doctor"], deps, cap.streams);

    expect(cap.out()).not.toContain(KEY_CANARY);
    expect(cap.out()).not.toContain(KEY_CANARY.slice(0, 8));
    expect(cap.err()).not.toContain(KEY_CANARY);
    expect(cap.err()).not.toContain(KEY_CANARY.slice(0, 8));
    expect(cap.out()).toContain("ANTHROPIC_API_KEY");
  });

  it("is listed in the top-level help", async () => {
    const cap = captureStreams();

    await run(["--help"], recordingDeps().deps, cap.streams);

    expect(cap.out()).toContain("doctor");
  });
});
