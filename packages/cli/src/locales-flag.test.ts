import { describe, expect, it } from "vitest";
import { run } from "./run.js";
import { captureStreams, recordingDeps } from "./test-support.js";

describe("translate --locales", () => {
  it("parses a comma-separated list into the SDK call, trimming and dropping blanks", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["translate", "--locales", "de, fr ,"], deps, cap.streams);

    expect(code).toBe(0);
    expect(calls.translate[0]).toMatchObject({ locales: ["de", "fr"] });
  });

  it("omits locales entirely when the flag is absent", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["translate"], deps, cap.streams);

    expect(calls.translate[0]).not.toHaveProperty("locales");
  });

  it("rejects an empty list as a usage error: exit 2, stderr, clean stdout, no SDK call", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["translate", "--locales", ""], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[INVALID_LOCALES]");
    expect(cap.out()).toBe("");
    expect(calls.translate).toHaveLength(0);
  });

  it("is listed in the translate help text", async () => {
    const { deps } = recordingDeps();
    const cap = captureStreams();

    await run(["translate", "--help"], deps, cap.streams);

    expect(cap.out()).toContain("--locales <list>");
  });
});

describe("watch --locales", () => {
  it("parses a comma-separated list into the SDK watch call", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["watch", "--locales", "de,fr"], deps, cap.streams, {
      onWatchSession: (session) => {
        session.requestStop();
      },
    });

    expect(calls.watch[0]).toMatchObject({ locales: ["de", "fr"] });
  });

  it("omits locales entirely when the flag is absent", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["watch"], deps, cap.streams, {
      onWatchSession: (session) => {
        session.requestStop();
      },
    });

    expect(calls.watch[0]).not.toHaveProperty("locales");
  });

  it("rejects an empty list as a usage error before the session starts", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["watch", "--locales", ","], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[INVALID_LOCALES]");
    expect(calls.watch).toHaveLength(0);
  });

  it("is listed in the watch help text", async () => {
    const { deps } = recordingDeps();
    const cap = captureStreams();

    await run(["watch", "--help"], deps, cap.streams);

    expect(cap.out()).toContain("--locales <list>");
  });
});
