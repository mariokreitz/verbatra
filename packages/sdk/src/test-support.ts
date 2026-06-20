import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ProviderNotice,
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
} from "@verbatra/ai-providers";
import type { PlaceholderIntegrityResult } from "@verbatra/core";
import type { VerbatraConfig } from "./config/schema.js";
import type { BoundedBytesRead, BoundedFileRead, SdkFs } from "./fs.js";

export interface StubCall {
  readonly request: TranslateRequest;
}

export interface StubOptions {
  readonly id?: string;
  readonly kind?: "llm" | "machine-translation";
  readonly translate?: (value: string, key: string, targetLocale: string) => string;
  readonly failIntegrity?: ReadonlySet<string>;
  readonly notices?: readonly ProviderNotice[];
  readonly throwForLocales?: ReadonlySet<string>;
  readonly error?: Error;
}

export interface StubProvider {
  readonly provider: TranslationProvider;
  readonly calls: StubCall[];
}

const PASS: PlaceholderIntegrityResult = {
  matches: true,
  missing: [],
  extra: [],
  reordered: false,
};
const FAIL: PlaceholderIntegrityResult = {
  matches: false,
  missing: ["{x}"],
  extra: [],
  reordered: false,
};

function defaultTranslate(value: string, _key: string, locale: string): string {
  return `[${locale}] ${value}`;
}

/** An offline stub provider that records every request and returns deterministic values. */
export function makeStubProvider(options: StubOptions = {}): StubProvider {
  const calls: StubCall[] = [];
  const translate = options.translate ?? defaultTranslate;
  const provider: TranslationProvider = {
    id: options.id ?? "stub",
    kind: options.kind ?? "llm",
    supportsGlossary: true,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      calls.push({ request });
      if (options.throwForLocales?.has(request.targetLocale) === true) {
        throw options.error ?? new Error("stub provider failure");
      }
      const values = new Map<string, string>();
      const integrity = new Map<string, PlaceholderIntegrityResult>();
      for (const entry of request.entries) {
        values.set(entry.key, translate(entry.value, entry.key, request.targetLocale));
        integrity.set(entry.key, options.failIntegrity?.has(entry.key) === true ? FAIL : PASS);
      }
      const result: TranslateResult & { notices?: readonly ProviderNotice[] } =
        options.notices !== undefined
          ? { values, integrity, notices: options.notices }
          : { values, integrity };
      return result;
    },
  };
  return { provider, calls };
}

/** A valid base config for tests; override fields as needed. */
export function baseConfig(overrides: Partial<VerbatraConfig> = {}): VerbatraConfig {
  return {
    sourceLocale: "en",
    targetLocales: ["de"],
    format: "i18next-json",
    files: { pattern: "locales/{locale}.json" },
    provider: { id: "anthropic", options: { model: "test-model", maxTokens: 256 } },
    ...overrides,
  };
}

export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "verbatra-sdk-"));
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/**
 * A complete in-memory {@link SdkFs} for tests: every method defaults to a benign no-op
 * ("missing" reads, accepted writes), and any subset can be overridden. Keeps test fakes
 * from having to spell out every interface method when they only care about one of them.
 */
export function makeFakeFs(overrides: Partial<SdkFs> = {}): SdkFs {
  return {
    fileExists: async (): Promise<boolean> => false,
    readFileBounded: async (): Promise<BoundedFileRead> => ({ kind: "missing" }),
    readBytesBounded: async (): Promise<BoundedBytesRead> => ({ kind: "missing" }),
    writeFile: async (): Promise<void> => {},
    writeBytes: async (): Promise<void> => {},
    ...overrides,
  };
}
