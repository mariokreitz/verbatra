import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AdapterRegistry,
  createDefaultRegistry,
  type FormatAdapter,
} from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { baseConfig, makeStubProvider, makeTempDir, writeJsonFile } from "../test-support.js";
import { translate } from "./translate-project.js";

function cfg(overrides: Partial<VerbatraConfig> = {}): VerbatraConfig {
  return baseConfig({ targetLocales: ["de"], ...overrides });
}

async function project(
  source: Record<string, unknown>,
  targets: Record<string, Record<string, unknown> | undefined>,
): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  for (const [locale, obj] of Object.entries(targets)) {
    if (obj !== undefined) {
      await writeJsonFile(join(dir, "locales", `${locale}.json`), obj);
    }
  }
  return dir;
}

function targetPath(dir: string, locale: string): string {
  return join(dir, "locales", `${locale}.json`);
}

/**
 * A registry holding the real i18next adapter wrapped so every `write` is recorded. A wrapper on a
 * private registry rather than a patched shared one, so nothing leaks between tests. The spy is the
 * assertion the acceptance criteria ask for: an mtime comparison cannot fail spuriously but it can
 * pass spuriously on a coarse filesystem, and it proves less than "the write never happened".
 */
function spyingRegistry(): { registry: AdapterRegistry; writes: string[] } {
  const resolution = createDefaultRegistry().resolve("", { format: "i18next-json" });
  if (resolution.status !== "resolved") {
    throw new Error("the default registry did not resolve the i18next adapter");
  }
  const real = resolution.adapter;
  const writes: string[] = [];
  const adapter: FormatAdapter = {
    ...real,
    write: async (resource, path) => {
      writes.push(path);
      return real.write(resource, path);
    },
  };
  return { registry: new AdapterRegistry().register(adapter), writes };
}

describe("translate: a live run that changes nothing does not rewrite the target", () => {
  it("does not call adapter.write on a second run over a fully translated project", async () => {
    const dir = await project({ a: "A" }, { de: { a: "da" } });
    const stub = makeStubProvider();
    const { registry, writes } = spyingRegistry();

    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider, adapterRegistry: registry },
    );

    expect(summary.locales[0]?.translated).toEqual([]);
    expect(summary.locales[0]?.unchanged).toEqual(["a"]);
    expect(stub.calls).toHaveLength(0);
    expect(writes).toEqual([]);
  });

  it("leaves the target's inode and bytes untouched on such a run", async () => {
    const dir = await project({ a: "A" }, { de: { a: "da" } });
    const stub = makeStubProvider();
    const path = targetPath(dir, "de");
    const before = await stat(path);
    const bytesBefore = await readFile(path, "utf8");

    await translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider });

    const after = await stat(path);
    expect(after.ino).toBe(before.ino);
    expect(await readFile(path, "utf8")).toBe(bytesBefore);
  });

  it("preserves a hand-formatted target, which a rewrite would reformat", async () => {
    const dir = await project({ a: "A" }, {});
    const handFormatted = '{\n    "a": "da"\n}\n';
    await writeFile(targetPath(dir, "de"), handFormatted);
    const stub = makeStubProvider();

    await translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider });

    expect(await readFile(targetPath(dir, "de"), "utf8")).toBe(handFormatted);
  });

  it("still writes when a key was translated", async () => {
    const dir = await project({ a: "A", b: "B" }, { de: { a: "da" } });
    const stub = makeStubProvider();
    const { registry, writes } = spyingRegistry();

    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider, adapterRegistry: registry },
    );

    expect(summary.locales[0]?.translated).toEqual(["b"]);
    expect(writes).toEqual([targetPath(dir, "de")]);
  });

  it("still writes when the only change is a prune", async () => {
    const dir = await project({ a: "A" }, { de: { a: "da", gone: "weg" } });
    const stub = makeStubProvider();
    const { registry, writes } = spyingRegistry();

    const summary = await translate(
      { config: cfg(), cwd: dir, prune: true },
      { createProvider: () => stub.provider, adapterRegistry: registry },
    );

    expect(summary.locales[0]?.pruned).toEqual(["gone"]);
    expect(writes).toEqual([targetPath(dir, "de")]);
    expect(await readFile(targetPath(dir, "de"), "utf8")).not.toContain("gone");
  });

  it("does not skip the write when an orphan is reported but pruning is off", async () => {
    const dir = await project({ a: "A" }, { de: { a: "da", gone: "weg" } });
    const stub = makeStubProvider();
    const { registry, writes } = spyingRegistry();

    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider, adapterRegistry: registry },
    );

    // Nothing accepted and nothing pruned, so the file is left exactly as it was, orphan included.
    expect(summary.locales[0]?.orphaned).toEqual(["gone"]);
    expect(writes).toEqual([]);
    expect(await readFile(targetPath(dir, "de"), "utf8")).toContain("gone");
  });

  it("still creates a target that does not exist yet, even with nothing to translate", async () => {
    // An empty source means nothing is accepted, which is the same predicate a no-op run hits. The
    // file must appear anyway, or a later import of this locale fails on a missing file.
    const dir = await project({}, { de: undefined });
    const stub = makeStubProvider();
    const { registry, writes } = spyingRegistry();

    await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider, adapterRegistry: registry },
    );

    expect(writes).toEqual([targetPath(dir, "de")]);
    expect(await readFile(targetPath(dir, "de"), "utf8")).toBe("{}\n");
  });
});
