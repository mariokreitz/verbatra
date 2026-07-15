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
  // This grep scans for the literal call-shaped substrings of the four sdk functions Phase 1
  // never imported at all (translate, watch, importWorkbook, exportWorkbook); it does not, and by
  // its own literal pattern list cannot, cover retranslateEntry (a fifth, later, capability-gated
  // write seam with a different name). That seam's own reachability is proved separately by
  // "capability-gated proof" below and by server/rpc.test.ts's createRpcHandlers tests; this proof
  // still holds unconditionally for the four names it actually checks.
  it("never calls translate(, watch(, importWorkbook(, or exportWorkbook( anywhere in studio's own source", () => {
    // Built via concatenation so this file's own source text never contains the literal
    // call-shaped substring it searches for. Each pattern requires the call to be unqualified (not
    // preceded by "." or a word character), so it matches only a bare call to the sdk's own
    // imported function (for example `watch(...)`) and not a qualified call on some other object
    // that merely shares the method name, such as a future chokidar `.watch(...)` call once the
    // live-refresh watcher lands.
    const forbidden = ["translate", "watch", "importWorkbook", "exportWorkbook"].map(
      (name) => new RegExp(`(?<![.\\w])${name}\\(`),
    );
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
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

// Proves "no write-capable call is reachable when neither capability flag is set", not an
// absolute, permanent, repository-wide invariant: with both flags off (the default `withServer`
// below never sets them), translation.retranslateEntry is absent from the dispatch registry
// (server/rpc.ts's createRpcHandlers), so driving every registered method still leaves the tree
// untouched. This no longer holds unconditionally once a server is started with both capabilities
// on; that flag-dependent reachability is covered separately by
// create-studio-server.capabilities.test.ts, not by this proof.
describe("read-only proof: the fixture project's file tree is untouched", () => {
  it("hashes identically before and after driving every registered method through the server", async () => {
    const project = await makeFixtureProject();
    try {
      const before = await hashTree(project.root);

      await withServer(
        async (server) => {
          const cookie = await authenticatedCookie(server.url, "read-only-proof-token");
          const methods = [
            "project.snapshot",
            "status.check",
            "status.diff",
            "glossary.get",
            "lock.state",
            "history.list",
          ];
          for (const method of methods) {
            await fetch(new URL("/rpc", server.url), {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
                Origin: server.url.replace(/\/$/, ""),
              },
              body: JSON.stringify({ method, params: {} }),
            });
          }
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
