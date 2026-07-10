import type { TranslationEntry } from "@verbatra/core";
import { DOMParser, type Document, type Element, type Node, XMLSerializer } from "@xmldom/xmldom";
import { AdapterError } from "../errors.js";
import { type BoundedReadOutcome, readBounded } from "../json/bounded-read.js";
import { extractXliffPlaceholders } from "./placeholders.js";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

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

/**
 * Key a trans-unit by its `id`, falling back to `resname`, and only then to a positional
 * `unit-${index}` derived from document order.
 *
 * The positional fallback is inherently unstable: it carries no identity of its own, so adding or
 * removing one id-less (and resname-less) unit anywhere earlier in the document shifts every later
 * synthesized key. Between runs this silently re-attaches a previously stored translation, diff
 * baseline, or check result to the wrong unit. There is no better key available for a unit that
 * declares neither `id` nor `resname`, so this stays a documented degradation rather than an error;
 * XLIFF producers that need stable identity across runs should emit an `id` (or `resname`) on every
 * trans-unit.
 */
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
 * `INVALID_XML`; a non-XLIFF document is `INVALID_STRUCTURE`; two trans-units resolving to the same
 * key (typically a duplicate `id`) is also `INVALID_STRUCTURE`, since silently keeping one and
 * dropping the other would lose data on read and misdirect a translation on write.
 */
export function parseXliffEntries(
  content: string,
  namespace: string,
): Map<string, TranslationEntry> {
  const { root } = parseXml(content);
  const serializer = new XMLSerializer();
  const out = new Map<string, TranslationEntry>();
  for (const unit of walkUnits(root)) {
    if (out.has(unit.key)) {
      throw new AdapterError(
        "INVALID_STRUCTURE",
        "The XLIFF file has two trans-units with the same id.",
      );
    }
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

/**
 * The genuine XLIFF inline elements allowed to survive as live elements inside a written
 * `<target>`. Anything else in a translated value (an unexpected tag, a script-bearing element, or
 * any other markup a provider or translator might introduce) degrades the whole value to a text
 * node instead, the same fallback already used for unbalanced markup. An element only qualifies when
 * it also carries an allowed namespace (see {@link isAllowedInlineElement}); an element with the same
 * local name under any other namespace is rejected.
 */
const XLIFF_INLINE_ELEMENTS = new Set(["x", "g", "bx", "ex", "ph", "it", "mrk"]);

/**
 * The XLIFF 1.2 and 2.0 document namespaces. A source document that declares a default `xmlns` on
 * its root propagates that namespace onto every inline element `innerXml` serializes out of it, so a
 * translated value re-derived from that source (for example a seeded, not-yet-translated target)
 * legitimately carries this namespace on its inline elements. An element with no namespace at all
 * (the common case, since translators and providers typically write bare `<g id="1">` with no
 * `xmlns`) is also accepted; any other namespace is attacker-controlled and rejected.
 */
const XLIFF_NAMESPACES = new Set([
  "urn:oasis:names:tc:xliff:document:1.2",
  "urn:oasis:names:tc:xliff:document:2.0",
]);

/**
 * The attributes each allow-listed inline element keeps once it survives the filter. This is a
 * minimal, per-element allow-list rather than "strip everything": `id` identifies or pairs an inline
 * code, `rid` pairs a `bx` (begin) with its matching `ex` (end), and `ctype`/`pos`/`mtype` are free-text
 * metadata describing the original inline markup (for example "bold" or "italic"). None of these
 * carry a URL, an event handler, or style data, so none provide an execution or navigation sink. Every
 * other attribute (`xlink:href`, `on*` handlers, `style`, unrecognized `xmlns*` declarations, and
 * anything else) is stripped, regardless of which element it appears on.
 */
const INLINE_ELEMENT_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  x: ["id", "ctype"],
  ph: ["id", "ctype"],
  g: ["id", "ctype"],
  bx: ["id", "rid", "ctype"],
  ex: ["id", "rid"],
  it: ["id", "pos", "ctype"],
  mrk: ["id", "mtype"],
};

/**
 * An allow-listed inline element, matched by local name, whose namespace is either absent or one of
 * {@link XLIFF_NAMESPACES}. Any other namespace (an attacker-chosen one, or a genuine but unrelated
 * one) is rejected even when the local name matches.
 */
function isAllowedInlineElement(element: Element): boolean {
  const namespace = element.namespaceURI;
  const hasAllowedNamespace = namespace === null || XLIFF_NAMESPACES.has(namespace);
  return hasAllowedNamespace && XLIFF_INLINE_ELEMENTS.has(element.localName ?? "");
}

/** True for a plain text node, or an element that passes {@link isAllowedInlineElement}. */
function isAllowedFragmentNode(node: Node): boolean {
  if (node.nodeType === TEXT_NODE) {
    return true;
  }
  return isElement(node) && isAllowedInlineElement(node);
}

/**
 * Every node reachable under `root`, at any depth, in document order. Walking every node (not just
 * elements) is what lets {@link hasDisallowedNode} catch CDATA sections, comments, and processing
 * instructions in addition to unexpected elements.
 */
function allDescendantNodes(node: Node): Node[] {
  const children = Array.from(node.childNodes);
  return children.flatMap((child) => [child, ...allDescendantNodes(child)]);
}

/**
 * True when the fragment contains anything other than plain text and allow-listed, unnamespaced
 * inline elements: an unexpected or namespaced element, a CDATA section, a comment, or a processing
 * instruction. Any of these degrades the whole value to a single escaped text node in
 * {@link fragmentNodes}, so none of them reach the written `<target>` as live markup.
 */
function hasDisallowedNode(root: Element): boolean {
  return allDescendantNodes(root).some((node) => !isAllowedFragmentNode(node));
}

/** The qualified names of every attribute on `element`, snapshotted before any removal. */
function attributeNames(element: Element): string[] {
  const names: string[] = [];
  for (let i = 0; i < element.attributes.length; i += 1) {
    const attr = element.attributes.item(i);
    if (attr !== null) {
      names.push(attr.name);
    }
  }
  return names;
}

/**
 * Strip every attribute not on that element's entry in {@link INLINE_ELEMENT_ATTRIBUTES}. Called only
 * after {@link hasDisallowedNode} has confirmed every element in the fragment is on the inline
 * allow-list, so `getElementsByTagName("*")` here only ever visits elements with a known attribute
 * allow-list. Attribute names are snapshotted first (see {@link attributeNames}) because removing
 * from the live `attributes` collection while iterating it would skip entries.
 */
function sanitizeInlineAttributes(root: Element): void {
  for (const el of collectByTag(root, "*")) {
    const allowed = INLINE_ELEMENT_ATTRIBUTES[el.localName ?? ""] ?? [];
    for (const name of attributeNames(el)) {
      if (!allowed.includes(name)) {
        el.removeAttribute(name);
      }
    }
  }
}

/**
 * Re-parse a translated value as an XML fragment so inline placeholder elements (`<x>`, `<g>`, and
 * the rest of {@link XLIFF_INLINE_ELEMENTS}) survive as live nodes in the written `<target>`. A
 * translated value is untrusted input (it may come from a provider or a human translator), so this
 * is a deliberate, narrow markup-interpreting surface: `assertNoDoctype` runs first and rejects a
 * DTD or entity declaration outright (this must stay outside the catch below, or the throw would be
 * swallowed into a silent text-node fallback); any node outside the allow-list checked by
 * {@link hasDisallowedNode}, including a namespaced element, a CDATA section, a comment, or a
 * processing instruction, also fails the fragment, degrading the entire value to a text node.
 * Surviving elements then have their attributes narrowed by {@link sanitizeInlineAttributes}.
 * Genuinely malformed or unbalanced markup takes the same text-node fallback.
 */
function fragmentNodes(parser: DOMParser, value: string): Node[] | null {
  assertNoDoctype(value);
  try {
    const root = parser.parseFromString(`<wrapper>${value}</wrapper>`, "text/xml").documentElement;
    if (root === null || hasDisallowedNode(root)) {
      return null;
    }
    sanitizeInlineAttributes(root);
    return Array.from(root.childNodes);
  } catch {
    return null;
  }
}

/**
 * Write a translated value into a `<target>` element. The value is re-parsed as an XML fragment (see
 * {@link fragmentNodes}) so inline placeholder markup survives; anything that fails that narrow
 * allow-list, or is not well-formed XML at all, is written as a single plain text node instead. So a
 * translated value can only ever contribute plain text or an allow-listed inline element (with no
 * namespace, or the genuine XLIFF 1.2/2.0 document namespace) carrying its own minimal, non-executable
 * attribute set; it can never inject an unexpected element, an element under a spoofed namespace, CDATA,
 * a comment, a processing instruction, or an attribute like `onclick` or `xlink:href` into the document.
 */
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
