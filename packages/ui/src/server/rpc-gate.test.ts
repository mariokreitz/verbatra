import { AdapterError } from "@verbatra/format-adapters";
import { SdkError } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import type { RpcHandlerDeps } from "./rpc.js";
import { dispatchRpc } from "./rpc-gate.js";
import { baseUiConfig } from "./test-support.js";

function deps(): RpcHandlerDeps {
  return {
    config: { config: baseUiConfig(), source: { kind: "override" }, glossary: { source: "none" } },
    projectRoot: "/project",
  };
}

function body(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}

class FakeDomainError extends Error {
  readonly code: string;

  constructor(name: string, code: string, message: string) {
    super(message);
    this.name = name;
    this.code = code;
  }
}

async function parseBody(result: { body: string }): Promise<Record<string, unknown>> {
  return JSON.parse(result.body) as Record<string, unknown>;
}

describe("dispatchRpc envelope", () => {
  it("answers 400 REQUEST_INVALID for a body that is not JSON", async () => {
    const result = await dispatchRpc(Buffer.from("not json"), deps(), {});

    expect(result.statusCode).toBe(400);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "REQUEST_INVALID" } });
  });

  it("answers 400 REQUEST_INVALID for JSON that is not { method, params } shaped", async () => {
    const result = await dispatchRpc(body(["not", "an", "object"]), deps(), {});

    expect(result.statusCode).toBe(400);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "REQUEST_INVALID" } });
  });

  it("answers 400 REQUEST_INVALID when method is present but not a string", async () => {
    const result = await dispatchRpc(body({ method: 1, params: {} }), deps(), {});

    expect(result.statusCode).toBe(400);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "REQUEST_INVALID" } });
  });

  it("answers 400 METHOD_UNKNOWN for a method not in the shared contract", async () => {
    const result = await dispatchRpc(body({ method: "not.a.method", params: {} }), deps(), {});

    expect(result.statusCode).toBe(400);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
  });

  it("answers 400 METHOD_UNKNOWN for a contract method with no registered handler", async () => {
    const result = await dispatchRpc(body({ method: "status.check", params: {} }), deps(), {});

    expect(result.statusCode).toBe(400);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
  });

  it("answers 400 PARAMS_INVALID carrying only issue paths and codes, never a message or the received value", async () => {
    const result = await dispatchRpc(
      body({ method: "status.check", params: { locales: [] } }),
      deps(),
      {},
    );

    expect(result.statusCode).toBe(400);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "PARAMS_INVALID" } });
    const error = parsed.error as { issues: readonly { path: string[]; code: string }[] };
    expect(error.issues).toEqual([{ path: ["locales"], code: "too_small" }]);
    expect(result.body).not.toContain("secret-locale-value");
  });

  it("answers 400 PARAMS_INVALID for status.diff's own separately-declared empty locales array", async () => {
    const result = await dispatchRpc(
      body({ method: "status.diff", params: { locales: [] } }),
      deps(),
      {},
    );

    expect(result.statusCode).toBe(400);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "PARAMS_INVALID" } });
    const error = parsed.error as { issues: readonly { path: string[]; code: string }[] };
    expect(error.issues).toEqual([{ path: ["locales"], code: "too_small" }]);
  });

  it("answers 200 ok:true with the handler's result on success", async () => {
    const result = await dispatchRpc(body({ method: "project.snapshot", params: {} }), deps(), {
      "project.snapshot": async () => ({
        sourceLocale: "en",
        targetLocales: ["de"],
        format: "i18next-json",
        files: { pattern: "locales/{locale}.json" },
        provider: { id: "anthropic" },
        configSource: "override",
        glossary: { source: "none" },
      }),
    });

    expect(result.statusCode).toBe(200);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: true, result: { sourceLocale: "en" } });
  });

  it("maps a handler throw shaped like an SdkError to 200 ok:false with its code and redacted message", async () => {
    const result = await dispatchRpc(body({ method: "project.snapshot", params: {} }), deps(), {
      "project.snapshot": async () => {
        throw new FakeDomainError("SdkError", "CONFIG_NOT_FOUND", "sk-abcd1234efgh5678 leaked");
      },
    });

    expect(result.statusCode).toBe(200);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "CONFIG_NOT_FOUND" } });
    expect(result.body).not.toContain("sk-abcd1234efgh5678");
    expect(result.body).toContain("[REDACTED]");
  });

  it("maps a handler throw shaped like an AdapterError to 200 ok:false with its code", async () => {
    const result = await dispatchRpc(body({ method: "project.snapshot", params: {} }), deps(), {
      "project.snapshot": async () => {
        throw new FakeDomainError("AdapterError", "INVALID_JSON", "the file is not valid JSON");
      },
    });

    expect(result.statusCode).toBe(200);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
  });

  it("maps a real SdkError thrown by a handler to 200 ok:false with its own code and message", async () => {
    const result = await dispatchRpc(body({ method: "project.snapshot", params: {} }), deps(), {
      "project.snapshot": async () => {
        throw new SdkError("CONFIG_NOT_FOUND", "No verbatra configuration found.");
      },
    });

    expect(result.statusCode).toBe(200);
    const parsed = await parseBody(result);
    expect(parsed).toEqual({
      ok: false,
      error: { code: "CONFIG_NOT_FOUND", message: "No verbatra configuration found." },
    });
  });

  it("maps a real AdapterError thrown by a handler to 200 ok:false with its own code and message", async () => {
    const result = await dispatchRpc(body({ method: "project.snapshot", params: {} }), deps(), {
      "project.snapshot": async () => {
        throw new AdapterError("INVALID_JSON", "the file is not parseable JSON.");
      },
    });

    expect(result.statusCode).toBe(200);
    const parsed = await parseBody(result);
    expect(parsed).toEqual({
      ok: false,
      error: { code: "INVALID_JSON", message: "the file is not parseable JSON." },
    });
  });

  it("maps any other handler throw to a constant 500 INTERNAL body with no path substring", async () => {
    const result = await dispatchRpc(body({ method: "project.snapshot", params: {} }), deps(), {
      "project.snapshot": async () => {
        throw new Error(
          "ENOENT: no such file or directory, open '/Users/someone/secret/verbatra.config.ts'",
        );
      },
    });

    expect(result.statusCode).toBe(500);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(result.body).not.toContain("/Users/someone/secret");
    expect(result.body).not.toContain("ENOENT");
  });

  it("defaults to the production handler registry when none is injected", async () => {
    const result = await dispatchRpc(body({ method: "project.snapshot", params: {} }), deps());

    expect(result.statusCode).toBe(200);
    const parsed = await parseBody(result);
    expect(parsed).toMatchObject({ ok: true });
  });
});
