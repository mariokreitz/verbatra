import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAsset, resolveAssetPath } from "./static-assets.js";

describe("resolveAssetPath", () => {
  const assetsRootPath = join(tmpdir(), "verbatra-ui-assets-root");

  it("resolves the root request to index.html", () => {
    expect(resolveAssetPath(assetsRootPath, "/")).toBe(join(assetsRootPath, "index.html"));
  });

  it("resolves a nested request within the root", () => {
    expect(resolveAssetPath(assetsRootPath, "/assets/app.js")).toBe(
      join(assetsRootPath, "assets", "app.js"),
    );
  });

  it("strips a query string before resolving", () => {
    expect(resolveAssetPath(assetsRootPath, "/assets/app.js?v=1")).toBe(
      join(assetsRootPath, "assets", "app.js"),
    );
  });

  it("decodes a percent-encoded request path", () => {
    expect(resolveAssetPath(assetsRootPath, "/assets/a%20b.js")).toBe(
      join(assetsRootPath, "assets", "a b.js"),
    );
  });

  it("falls back to the raw path when percent-decoding fails", () => {
    expect(resolveAssetPath(assetsRootPath, "/assets/%.js")).toBe(
      join(assetsRootPath, "assets", "%.js"),
    );
  });

  it("rejects a request path that escapes the assets root", () => {
    expect(resolveAssetPath(assetsRootPath, "/../secret.txt")).toBeUndefined();
  });

  it("accepts an assets root with a trailing separator, as fileURLToPath produces for a directory URL", () => {
    expect(resolveAssetPath(`${assetsRootPath}/`, "/")).toBe(join(assetsRootPath, "index.html"));
    expect(resolveAssetPath(`${assetsRootPath}/`, "/assets/app.js")).toBe(
      join(assetsRootPath, "assets", "app.js"),
    );
  });

  it("rejects a deeply nested traversal attempt", () => {
    expect(resolveAssetPath(assetsRootPath, "/a/../../../etc/passwd")).toBeUndefined();
  });

  it("rejects a dotfile at the root", () => {
    expect(resolveAssetPath(assetsRootPath, "/.env")).toBeUndefined();
  });

  it("rejects a dotfile nested under a normal directory", () => {
    expect(resolveAssetPath(assetsRootPath, "/config/.secret")).toBeUndefined();
  });

  it("rejects a dot-directory segment even when the final segment is a normal file", () => {
    expect(resolveAssetPath(assetsRootPath, "/.git/config")).toBeUndefined();
  });

  it("rejects a percent-encoded dotfile request", () => {
    expect(resolveAssetPath(assetsRootPath, "/%2eenv")).toBeUndefined();
  });
});

describe("readAsset", () => {
  let assetsRootPath: string;

  beforeEach(async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-assets-"));
    await mkdir(join(assetsRootPath, "nested"), { recursive: true });
    await writeFile(join(assetsRootPath, "index.html"), "<html>root</html>");
    await writeFile(join(assetsRootPath, "nested", "style.css"), "body { color: black; }");
  });

  afterEach(async () => {
    await rm(assetsRootPath, { recursive: true, force: true });
  });

  it("reads an existing asset at the root", async () => {
    const asset = await readAsset(assetsRootPath, "/index.html");

    expect(asset?.path).toBe(join(assetsRootPath, "index.html"));
    expect(asset?.body.toString("utf8")).toBe("<html>root</html>");
  });

  it("reads an existing nested asset", async () => {
    const asset = await readAsset(assetsRootPath, "/nested/style.css");

    expect(asset?.body.toString("utf8")).toBe("body { color: black; }");
  });

  it("returns undefined for a missing asset", async () => {
    await expect(readAsset(assetsRootPath, "/missing.js")).resolves.toBeUndefined();
  });

  it("returns undefined for a traversal attempt even when the target exists on disk", async () => {
    const secretPath = join(assetsRootPath, "..", "verbatra-ui-secret-fixture.txt");
    await writeFile(secretPath, "secret");

    try {
      await expect(
        readAsset(assetsRootPath, "/../verbatra-ui-secret-fixture.txt"),
      ).resolves.toBeUndefined();
    } finally {
      await rm(secretPath, { force: true });
    }
  });

  it("returns undefined for a dotfile that exists on disk", async () => {
    await writeFile(join(assetsRootPath, ".env"), "SECRET=1");

    await expect(readAsset(assetsRootPath, "/.env")).resolves.toBeUndefined();
  });
});
