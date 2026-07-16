import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  authenticatedCookie,
  fixtureLoader,
  makeFixtureProject,
  withServer,
} from "./test-support.js";

const SRC_ROOT = fileURLToPath(new URL("../", import.meta.url));

function collectSourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
      continue;
    }
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("static proof: no write-capable sdk call is ever referenced", () => {
  // This grep scans for the literal call-shaped substrings of the three sdk functions never
  // imported at all (watch, importWorkbook, exportWorkbook); it does not, and by its own literal
  // pattern list cannot, cover retranslateEntry or translatePending (two later, capability-gated
  // write seams, one calling translate() directly by design). Those seams' own reachability is
  // proved separately by "capability-gated proof" below and by server/rpc.test.ts's
  // createRpcHandlers tests; this proof still holds unconditionally for the three names it
  // actually checks. `translate` itself was in this list before the write-half addendum to the
  // live-change-signal feature added `translation.translatePending`, whose handler
  // (server/methods/translate-pending.ts) calls the sdk's `translate()` by design, the same
  // whole-project call the CLI's own `verbatra translate` already performs; that one, deliberate
  // call site is excluded from `collectSourceFiles` scanning below instead of weakening this
  // proof for every other file.
  it("never calls watch(, importWorkbook(, or exportWorkbook( anywhere in studio's own source, and calls translate( only from the one handler that is meant to", () => {
    // Built via concatenation so this file's own source text never contains the literal
    // call-shaped substring it searches for. Each pattern requires the call to be unqualified (not
    // preceded by "." or a word character), so it matches only a bare call to the sdk's own
    // imported function (for example `watch(...)`) and not a qualified call on some other object
    // that merely shares the method name, such as a future chokidar `.watch(...)` call once the
    // live-refresh watcher lands.
    const forbidden = ["watch", "importWorkbook", "exportWorkbook", "translate"].map((name) => ({
      name,
      pattern: new RegExp(`(?<![.\\w])${name}\\(`),
    }));
    const allowedTranslateCaller = join(SRC_ROOT, "server", "methods", "translate-pending.ts");
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (file === allowedTranslateCaller) {
        continue;
      }
      const content = readFileSync(file, "utf8");
      for (const { pattern } of forbidden) {
        if (pattern.test(content)) {
          offenders.push(`${relative(SRC_ROOT, file)}: ${pattern.source}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

async function hashTree(root: string): Promise<string> {
  const entries: string[] = [];

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const content = await readFile(full);
      entries.push(`${relative(root, full)}:${content.toString("hex")}`);
    }
  }

  await walk(root);
  entries.sort();
  return createHash("sha256").update(entries.join("\n")).digest("hex");
}

// Proves "no provider-spending call is reachable on a default server", not an absolute,
// permanent, repository-wide invariant: without the spend flag (the default `withServer` below
// never sets it), translation.retranslateEntry and translation.translatePending are absent from
// the dispatch registry (server/rpc.ts's createRpcHandlers), so posting them answers
// METHOD_UNKNOWN and driving the read views leaves the tree untouched. A default server does
// register the local write methods (translation.editEntry and key.value; local editing needs no
// flag), so this proof deliberately drives only the read views and the refused spend methods;
// translation.editEntry's actual disk write is covered separately by
// create-studio-server.capabilities.test.ts, not by this proof.
describe("read-only proof: the fixture project's file tree is untouched", () => {
  it("hashes identically after driving the read views, and a default server answers METHOD_UNKNOWN for both spend methods", async () => {
    const project = await makeFixtureProject();
    try {
      const before = await hashTree(project.root);

      await withServer(
        async (server) => {
          const cookie = await authenticatedCookie(server.url, "read-only-proof-token");
          const postMethod = async (
            method: string,
            params: Record<string, unknown> = {},
          ): Promise<{ error?: { code?: string } }> => {
            const response = await fetch(new URL("/rpc", server.url), {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
                Origin: server.url.replace(/\/$/, ""),
              },
              body: JSON.stringify({ method, params }),
            });
            return (await response.json()) as { error?: { code?: string } };
          };
          const readMethods = [
            "project.snapshot",
            "status.check",
            "status.diff",
            "glossary.get",
            "lock.state",
            "history.list",
          ];
          for (const method of readMethods) {
            await postMethod(method);
          }
          // Valid-shaped params on purpose: the shared schema is validated before the registry is
          // consulted, so only a well-formed body proves the refusal is the absent handler itself.
          const retranslate = await postMethod("translation.retranslateEntry", {
            locale: "de",
            key: "greeting",
          });
          expect(retranslate.error?.code).toBe("METHOD_UNKNOWN");
          const translatePending = await postMethod("translation.translatePending");
          expect(translatePending.error?.code).toBe("METHOD_UNKNOWN");
        },
        {
          token: "read-only-proof-token",
          loader: fixtureLoader(project),
        },
      );

      const after = await hashTree(project.root);
      expect(after).toBe(before);
    } finally {
      await project.cleanup();
    }
  });
});

describe("static proof: the retranslateEntry handler never reads a provider's environment directly", () => {
  it("never references process.env, the PROVIDER_ENV table, or a raw provider construction call", () => {
    const path = join(SRC_ROOT, "server", "methods", "retranslate-entry.ts");
    const content = readFileSync(path, "utf8");

    expect(content).not.toContain("process.env");
    expect(content).not.toContain("PROVIDER_ENV");
    // The handler reaches a provider only by delegating to the sdk's retranslateEntry seam, which
    // itself is proved (packages/sdk's own retranslate-entry.no-direct-env.test.ts) to reach a
    // provider only through selectProvider; this handler never constructs one itself.
    expect(content).not.toMatch(/(?<![.\w])buildProvider\(/);
    expect(content).not.toMatch(/(?<![.\w])selectProvider\(/);
  });
});

describe("static proof: the translatePending handler never reads a provider's environment directly", () => {
  it("never references process.env, the PROVIDER_ENV table, or a raw provider construction call", () => {
    const path = join(SRC_ROOT, "server", "methods", "translate-pending.ts");
    const content = readFileSync(path, "utf8");

    expect(content).not.toContain("process.env");
    expect(content).not.toContain("PROVIDER_ENV");
    // The handler reaches a provider only by delegating to the sdk's translate() flow, which
    // itself reaches a provider only through selectProvider; this handler never constructs one
    // itself.
    expect(content).not.toMatch(/(?<![.\w])buildProvider\(/);
    expect(content).not.toMatch(/(?<![.\w])selectProvider\(/);
  });
});
