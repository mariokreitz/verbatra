import type { TranslationEntry } from "@verbatra/core";
import { DOMParser, type Document, type Element, type Node, XMLSerializer } from "@xmldom/xmldom";
import { AdapterError } from "../errors.js";
import { type BoundedReadOutcome, readBounded } from "../json/bounded-read.js";
import { extractXliffPlaceholders } from "./placeholders.js";

const ELEMENT_NODE = 1;

/** A resolved trans-unit slot: where to read the value from and where to write the target. */
interface Unit {
  readonly key: string;
  readonly source: Element;
  readonly target: Element | null;
  /** The element a missing `<target>` is created under (the trans-unit or the 2.0 segment). */
  readonly container: Element;
}

function isElement(node: Node): node is Element {
  return node.nodeType === ELEMENT_NODE;
}

function elementChildren(parent: Element): Element[] {
  return Array.from(parent.childNodes).filter(isElement);
}

function childByName(parent: Element, name: string): Element | null {
  return elementChildren(parent).find((el) => el.localName === name) ?? null;
}

function collectByTag(root: Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName(name));
}

function unitKey(element: Element, index: number): string {
  return element.getAttribute("id") ?? element.getAttribute("resname") ?? `unit-${index}`;
}

/** Throw on a fatal parse error so malformed XML surfaces; non-fatal levels are ignored. */
function onFatal(level: "warning" | "error" | "fatalError"): void {
  if (level === "fatalError") {
    throw new Error("malformed XML");
  }
}

/**
 * Reject XLIFF that declares a DTD or entity before it reaches the parser, a defense-in-depth guard
 * against XXE and entity-expansion attacks; well-formed XLIFF contains neither.
 *
 * @param content - the raw file contents to scan
 * @throws {@link AdapterError} `INVALID_XML` when a DTD or entity is declared
 */
function assertNoDoctype(content: string): void {
  if (/<!DOCTYPE/i.test(content) || /<!ENTITY/i.test(content)) {
    throw new AdapterError("INVALID_XML", "XLIFF with a DTD or entity declaration is rejected.");
  }
}

function parseXml(content: string): { doc: Document; root: Element } {
  assertNoDoctype(content);
  let doc: Document;
  try {
    doc = new DOMParser({ onError: onFatal }).parseFromString(content, "text/xml");
  } catch {
    throw new AdapterError("INVALID_XML", "The file is not valid XML.");
  }
  const root = doc.documentElement;
  if (root === null || root.localName !== "xliff") {
    throw new AdapterError("INVALID_STRUCTURE", "The file is not an XLIFF document.");
  }
  return { doc, root };
}

function walkXliff12(root: Element): Unit[] {
  const units: Unit[] = [];
  collectByTag(root, "trans-unit").forEach((tu, index) => {
    const source = childByName(tu, "source");
    if (source !== null) {
      units.push({
        key: unitKey(tu, index),
        source,
        target: childByName(tu, "target"),
        container: tu,
      });
    }
  });
  return units;
}

function walkXliff20(root: Element): Unit[] {
  const units: Unit[] = [];
  collectByTag(root, "unit").forEach((unit, index) => {
    const baseKey = unitKey(unit, index);
    const segments = elementChildren(unit).filter((el) => el.localName === "segment");
    segments.forEach((segment, segIndex) => {
      const source = childByName(segment, "source");
      if (source !== null) {
        const key = segments.length > 1 ? `${baseKey}#${segIndex}` : baseKey;
        units.push({ key, source, target: childByName(segment, "target"), container: segment });
      }
    });
  });
  return units;
}

function walkUnits(root: Element): Unit[] {
  const version = root.getAttribute("version") ?? "1.2";
  return version.startsWith("2") ? walkXliff20(root) : walkXliff12(root);
}

function innerXml(serializer: XMLSerializer, element: Element): string {
  return Array.from(element.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join("");
}

function unitValue(serializer: XMLSerializer, unit: Unit): string {
  if (unit.target !== null) {
    const targetXml = innerXml(serializer, unit.target);
    if (targetXml.trim() !== "") {
      return targetXml;
    }
  }
  return innerXml(serializer, unit.source);
}

/**
 * Parse XLIFF 1.2 or 2.0 into flat entries keyed by the trans-unit id (falling back to resname),
 * taking the target inner markup when present and non-empty, otherwise the source. Malformed XML is
 * `INVALID_XML`; a non-XLIFF document is `INVALID_STRUCTURE`.
 */
export function parseXliffEntries(
  content: string,
  namespace: string,
): Map<string, TranslationEntry> {
  const { root } = parseXml(content);
  const serializer = new XMLSerializer();
  const out = new Map<string, TranslationEntry>();
  for (const unit of walkUnits(root)) {
    const value = unitValue(serializer, unit);
    out.set(unit.key, {
      key: unit.key,
      namespace,
      value,
      placeholders: extractXliffPlaceholders(value),
      isPlural: false,
    });
  }
  return out;
}

async function readDestination(filePath: string): Promise<string> {
  let outcome: BoundedReadOutcome;
  try {
    outcome = await readBounded(filePath);
  } catch {
    throw new AdapterError("INVALID_STRUCTURE", "The destination XLIFF file does not exist.");
  }
  if (outcome.kind === "not-a-file") {
    throw new AdapterError("INVALID_STRUCTURE", "The destination path is not a regular file.");
  }
  if (outcome.kind === "too-large") {
    throw new AdapterError("INPUT_TOO_LARGE", "The file exceeds the maximum allowed size.");
  }
  return outcome.content;
}

function fragmentNodes(parser: DOMParser, value: string): Node[] | null {
  try {
    const root = parser.parseFromString(`<wrapper>${value}</wrapper>`, "text/xml").documentElement;
    return root === null ? null : Array.from(root.childNodes);
  } catch {
    return null;
  }
}

/** Re-parse the value as an XML fragment so inline placeholder elements survive; otherwise fall back to a single text node. */
function setTargetValue(doc: Document, parser: DOMParser, element: Element, value: string): void {
  while (element.firstChild !== null) {
    element.removeChild(element.firstChild);
  }
  const nodes = fragmentNodes(parser, value);
  if (nodes === null) {
    element.textContent = value;
    return;
  }
  for (const node of nodes) {
    element.appendChild(doc.importNode(node, true));
  }
}

/**
 * Serialize entries by mutating the destination XLIFF in place: write each value into its trans-unit
 * `<target>` (creating one when absent) and leave source, attributes, and notes untouched. A missing
 * destination raises `INVALID_STRUCTURE`, since a flat key/value map cannot synthesize source,
 * target, and attributes on its own.
 */
export async function serializeXliffEntries(
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
): Promise<string> {
  const { doc, root } = parseXml(await readDestination(filePath));
  const parser = new DOMParser({ onError: onFatal });
  for (const unit of walkUnits(root)) {
    const entry = entries.get(unit.key);
    if (entry !== undefined) {
      const target = unit.target ?? doc.createElement("target");
      if (unit.target === null) {
        unit.container.appendChild(target);
      }
      setTargetValue(doc, parser, target, entry.value);
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
