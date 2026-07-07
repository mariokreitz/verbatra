import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RpcHandlerDeps } from "./rpc.js";
import { dispatchRpc } from "./rpc-gate.js";
import { baseStudioConfig } from "./test-support.js";

const SENTINELS = {
  ANTHROPIC_API_KEY: "sentinel-anthropic-9f3ac1",
  OPENAI_API_KEY: "sentinel-openai-2b77e4",
  GEMINI_API_KEY: "sentinel-gemini-11cd90",
  DEEPL_API_KEY: "sentinel-deepl-77aa02",
} as const;

const ENV_VAR_NAMES = Object.keys(SENTINELS) as (keyof typeof SENTINELS)[];

class FakeDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SdkError";
    this.code = code;
  }
}

function body(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}

function depsWithSentinelConfig(): RpcHandlerDeps {
  const config = baseStudioConfig({
    sourceLocale: SENTINELS.ANTHROPIC_API_KEY,
    files: { pattern: `locales/{locale}-${SENTINELS.OPENAI_API_KEY}.json` },
  });
  return {
    config: {
      config,
      source: {
        kind: "explicit",
        filepath: `/project/${SENTINELS.OPENAI_API_KEY}/verbatra.config.ts`,
      },
      glossary: { source: "file", path: `/project/${SENTINELS.GEMINI_API_KEY}.json` },
    },
    projectRoot: "/project",
  };
}

describe("secret sweep across every registered method and error path", () => {
  const originalValues: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of ENV_VAR_NAMES) {
      originalValues[name] = process.env[name];
      process.env[name] = SENTINELS[name];
    }
  });

  afterEach(() => {
    for (const name of ENV_VAR_NAMES) {
      const value = originalValues[name];
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  function assertNoSentinel(responseBody: string): void {
    for (const sentinel of Object.values(SENTINELS)) {
      expect(responseBody).not.toContain(sentinel);
    }
  }

  it("never leaks a sentinel through the project.snapshot projection", async () => {
    const result = await dispatchRpc(
      body({ method: "project.snapshot", params: {} }),
      depsWithSentinelConfig(),
    );

    expect(result.statusCode).toBe(200);
    assertNoSentinel(result.body);
  });

  it("never leaks a sentinel through a mapped domain-error message", async () => {
    const result = await dispatchRpc(
      body({ method: "project.snapshot", params: {} }),
      depsWithSentinelConfig(),
      {
        "project.snapshot": async () => {
          throw new FakeDomainError("CONFIG_INVALID", `bad config near ${SENTINELS.DEEPL_API_KEY}`);
        },
      },
    );

    expect(result.statusCode).toBe(200);
    assertNoSentinel(result.body);
  });

  it("never leaks a sentinel for an unimplemented contract method", async () => {
    const result = await dispatchRpc(
      body({ method: "status.check", params: {} }),
      depsWithSentinelConfig(),
    );

    assertNoSentinel(result.body);
  });

  it("never leaks a sentinel for an unknown method or invalid params", async () => {
    const unknown = await dispatchRpc(
      body({ method: `not.${SENTINELS.ANTHROPIC_API_KEY}`, params: {} }),
      depsWithSentinelConfig(),
    );
    const invalidParams = await dispatchRpc(
      body({ method: "status.check", params: { locales: [] } }),
      depsWithSentinelConfig(),
    );

    assertNoSentinel(unknown.body);
    assertNoSentinel(invalidParams.body);
  });

  it("never leaks a sentinel through the constant INTERNAL body for an unexpected throw", async () => {
    const result = await dispatchRpc(
      body({ method: "project.snapshot", params: {} }),
      depsWithSentinelConfig(),
      {
        "project.snapshot": async () => {
          throw new Error(`unexpected failure near ${SENTINELS.ANTHROPIC_API_KEY}`);
        },
      },
    );

    expect(result.statusCode).toBe(500);
    assertNoSentinel(result.body);
  });
});
