import log from "loglevel";
import { describe, expect, it } from "vitest";
import { silenceSdkLogging } from "./client.js";

describe("DeepL SDK log suppression", () => {
  it("actually silences the 'deepl' logger the SDK uses (not merely calls setLevel)", () => {
    // Raise the SDK's logger as a host application might, then suppress and verify the
    // suppression took effect on that same singleton logger (shared via loglevel dedupe).
    // If a future deepl-node loglevel bump split the singleton, this assertion would fail
    // instead of letting content logging quietly resume.
    log.getLogger("deepl").setLevel("debug");
    silenceSdkLogging();
    expect(log.getLogger("deepl").getLevel()).toBe(log.levels.SILENT);
  });
});
