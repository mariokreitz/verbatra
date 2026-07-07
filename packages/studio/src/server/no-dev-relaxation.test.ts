import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SERVER_SRC_DIR = fileURLToPath(new URL(".", import.meta.url));

function listImplementationFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))
    .map((entry) => `${entry.parentPath}/${entry.name}`);
}

describe("no dev relaxation", () => {
  it("never branches Host, Origin, cookie, or token behavior on NODE_ENV or another dev signal", () => {
    const files = listImplementationFiles(SERVER_SRC_DIR);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("NODE_ENV");
    }
  });
});
