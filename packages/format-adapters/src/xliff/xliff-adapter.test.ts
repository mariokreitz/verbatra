import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LocaleResource, TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { createXliffAdapter } from "./xliff-adapter.js";

const adapter = createXliffAdapter();

const XLIFF_12 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2"><file source-language="en" target-language="de" datatype="plaintext"><body>
<trans-unit id="greeting" resname="greet"><source>Hello <x id="1"/></source><note priority="1">be friendly</note></trans-unit>
<trans-unit id="bye"><source>Bye</source><target>Tschuess</target></trans-unit>
</body></file></xliff>`;

const XLIFF_20 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" srcLang="en" trgLang="fr"><file id="f1"><unit id="u1"><segment><source>Hello {name}</source><target>Bonjour {name}</target></segment></unit></file></xliff>`;

async function tempFile(name: string, content: string): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "verbatra-xliff-")), name);
  await writeFile(path, content);
  return path;
}

async function readError(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

describe("createXliffAdapter detection", () => {
  it("handles .xlf and .xliff", () => {
    expect(adapter.canHandle("messages.xlf")).toBe(true);
    expect(adapter.canHandle("messages.xliff")).toBe(true);
    expect(adapter.canHandle("messages.json")).toBe(false);
  });

  it("sniffs a leading <xliff or <?xml token", () => {
    expect(adapter.canHandle("messages.xlf", '<?xml version="1.0"?>')).toBe(true);
    expect(adapter.canHandle("messages.xlf", '<xliff version="1.2">')).toBe(true);
    expect(adapter.canHandle("messages.xlf", "not xml")).toBe(false);
  });

  it("reports format xliff", () => {
    expect(adapter.format).toBe("xliff");
  });
});

describe("createXliffAdapter read", () => {
  it("parses XLIFF 1.2, reading source when no target and target when present", async () => {
    const { resource } = await adapter.read(await tempFile("m.xlf", XLIFF_12), "de");
    expect(resource.entries.get("greeting")?.value).toBe('Hello <x id="1"/>');
    expect(resource.entries.get("bye")?.value).toBe("Tschuess");
  });

  it("extracts inline placeholder ids", async () => {
    const { resource } = await adapter.read(await tempFile("m.xlf", XLIFF_12), "de");
    expect(resource.entries.get("greeting")?.placeholders).toEqual(['<x id="1"/>']);
  });

  it("parses XLIFF 2.0 unit/segment, preferring the target", async () => {
    const { resource } = await adapter.read(await tempFile("m.xliff", XLIFF_20), "fr");
    expect(resource.entries.get("u1")?.value).toBe("Bonjour {name}");
    expect(resource.entries.get("u1")?.placeholders).toEqual(["{name}"]);
  });

  it("reports malformed XML as INVALID_XML", async () => {
    const error = await readError(
      adapter.read(await tempFile("bad.xlf", "<xliff><file><body><trans-unit>"), "de"),
    );
    expect((error as AdapterError).code).toBe("INVALID_XML");
  });

  it("rejects a well-formed non-XLIFF document as INVALID_STRUCTURE", async () => {
    const error = await readError(
      adapter.read(await tempFile("other.xlf", "<root><a>1</a></root>"), "de"),
    );
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("rejects XLIFF declaring a DOCTYPE as INVALID_XML before parsing", async () => {
    const doc = `<?xml version="1.0"?>
<!DOCTYPE xliff [<!ELEMENT xliff ANY>]>
<xliff version="1.2"><file><body><trans-unit id="a"><source>A</source></trans-unit></body></file></xliff>`;
    const error = await readError(adapter.read(await tempFile("dtd.xlf", doc), "de"));
    expect((error as AdapterError).code).toBe("INVALID_XML");
  });

  it("rejects XLIFF declaring an ENTITY as INVALID_XML before parsing", async () => {
    const doc = `<?xml version="1.0"?>
<!DOCTYPE xliff [<!ENTITY xxe "payload">]>
<xliff version="1.2"><file><body><trans-unit id="a"><source>&xxe;</source></trans-unit></body></file></xliff>`;
    const error = await readError(adapter.read(await tempFile("ent.xlf", doc), "de"));
    expect((error as AdapterError).code).toBe("INVALID_XML");
  });

  it("rejects a lone ENTITY declaration regardless of letter case", async () => {
    const doc = `<!doctype xliff [<!entity x "y">]><xliff version="1.2"><file><body><trans-unit id="a"><source>A</source></trans-unit></body></file></xliff>`;
    const error = await readError(adapter.read(await tempFile("lc.xlf", doc), "de"));
    expect((error as AdapterError).code).toBe("INVALID_XML");
  });
});

describe("createXliffAdapter write (round-trip fidelity)", () => {
  it("preserves attributes and notes when writing back", async () => {
    const path = await tempFile("m.xlf", XLIFF_12);
    const { resource } = await adapter.read(path, "de");
    await adapter.write(resource, path);
    const written = await readFile(path, "utf8");
    expect(written).toContain('resname="greet"');
    expect(written).toContain('source-language="en"');
    expect(written).toContain('<note priority="1">be friendly</note>');
    const reread = await adapter.read(path, "de");
    expect(reread.resource.entries.get("bye")?.value).toBe("Tschuess");
  });

  it("creates a <target> for a unit that lacks one, seeding it from the read value", async () => {
    const path = await tempFile("m.xlf", XLIFF_12);
    const { resource } = await adapter.read(path, "de");
    await adapter.write(resource, path);
    const written = await readFile(path, "utf8");
    expect(written).toContain('<target>Hello <x id="1"/></target>');
  });

  it("writes a translated target value into an existing target", async () => {
    const path = await tempFile("m.xliff", XLIFF_20);
    const { resource } = await adapter.read(path, "fr");
    const entries = new Map(resource.entries);
    const u1 = entries.get("u1");
    if (u1) {
      entries.set("u1", { ...u1, value: "Salut {name}" });
    }
    await adapter.write({ ...resource, entries }, path);
    const reread = await adapter.read(path, "fr");
    expect(reread.resource.entries.get("u1")?.value).toBe("Salut {name}");
  });

  it("raises INVALID_STRUCTURE when the destination does not exist", async () => {
    const { resource } = await adapter.read(await tempFile("m.xlf", XLIFF_12), "de");
    const missing = join(await mkdtemp(join(tmpdir(), "verbatra-xliff-")), "absent.xlf");
    const error = await readError(adapter.write(resource, missing));
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("falls back to the source value when the target is empty", async () => {
    const doc = `<xliff version="1.2"><file><body><trans-unit id="e"><source>Src</source><target></target></trans-unit></body></file></xliff>`;
    const { resource } = await adapter.read(await tempFile("e.xlf", doc), "de");
    expect(resource.entries.get("e")?.value).toBe("Src");
  });

  it("keys by resname when there is no id, and by index when there is neither", async () => {
    const doc = `<xliff version="1.2"><file><body><trans-unit resname="rn"><source>Y</source></trans-unit><trans-unit><source>Z</source></trans-unit></body></file></xliff>`;
    const { resource } = await adapter.read(await tempFile("k.xlf", doc), "de");
    expect(resource.entries.get("rn")?.value).toBe("Y");
    expect(resource.entries.get("unit-1")?.value).toBe("Z");
  });

  it("skips a trans-unit that has no source element", async () => {
    const doc = `<xliff version="1.2"><file><body><trans-unit id="t"><target>only</target></trans-unit></body></file></xliff>`;
    const { resource } = await adapter.read(await tempFile("ns.xlf", doc), "de");
    expect(resource.entries.size).toBe(0);
  });

  it("defaults to the 1.2 walk when the root has no version attribute", async () => {
    const doc = `<xliff><file><body><trans-unit id="a"><source>A</source></trans-unit></body></file></xliff>`;
    const { resource } = await adapter.read(await tempFile("nover.xlf", doc), "de");
    expect(resource.entries.get("a")?.value).toBe("A");
  });

  it("keys each segment of a multi-segment 2.0 unit by index", async () => {
    const doc = `<xliff version="2.0"><file id="f"><unit id="u"><segment><source>One</source><target>Eins</target></segment><segment><source>Two</source><target>Zwei</target></segment></unit></file></xliff>`;
    const { resource } = await adapter.read(await tempFile("multi.xliff", doc), "de");
    expect(resource.entries.get("u#0")?.value).toBe("Eins");
    expect(resource.entries.get("u#1")?.value).toBe("Zwei");
  });

  it("skips a 2.0 segment that has no source element", async () => {
    const doc = `<xliff version="2.0"><file id="f"><unit id="u"><segment><target>NoSrc</target></segment><segment><source>S</source><target>T</target></segment></unit></file></xliff>`;
    const { resource } = await adapter.read(await tempFile("seg.xliff", doc), "de");
    expect([...resource.entries.keys()]).toEqual(["u#1"]);
    expect(resource.entries.get("u#1")?.value).toBe("T");
  });

  it("rejects empty content as a structured error", async () => {
    const error = await readError(adapter.read(await tempFile("empty.xlf", ""), "de"));
    expect(error).toBeInstanceOf(AdapterError);
  });

  it("falls back to a text node when a translated value is not well-formed XML", async () => {
    const path = await tempFile("m.xliff", XLIFF_20);
    const { resource } = await adapter.read(path, "fr");
    const entries = new Map(resource.entries);
    const u1 = entries.get("u1");
    if (u1) {
      entries.set("u1", { ...u1, value: "a < b & c" });
    }
    await adapter.write({ ...resource, entries }, path);
    const written = await readFile(path, "utf8");
    expect(written).toContain("a &lt; b &amp; c");
  });

  it("raises INVALID_STRUCTURE when the destination path is not a regular file", async () => {
    const { resource } = await adapter.read(await tempFile("m.xlf", XLIFF_12), "de");
    const dir = await mkdtemp(join(tmpdir(), "verbatra-xliff-dir-"));
    const error = await readError(adapter.write(resource, dir));
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("ignores entries whose key matches no trans-unit", async () => {
    const path = await tempFile("m.xlf", XLIFF_12);
    const stray: TranslationEntry = {
      key: "ghost",
      namespace: "m",
      value: "boo",
      placeholders: [],
      isPlural: false,
    };
    const resource: LocaleResource = {
      locale: "de",
      namespace: "m",
      format: "xliff",
      entries: new Map([["ghost", stray]]),
    };
    await adapter.write(resource, path);
    expect(await readFile(path, "utf8")).not.toContain("boo");
  });
});
