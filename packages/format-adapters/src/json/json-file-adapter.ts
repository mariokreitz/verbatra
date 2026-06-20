import { basename, extname } from "node:path";
import type { LocaleResource, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter, ReadResult } from "../adapter.js";
import { AdapterError } from "../errors.js";
import { atomicWriteFile } from "./atomic-write.js";
import { readBounded } from "./bounded-read.js";
import { type DeriveEntry, flattenTree } from "./flatten.js";
import { type JsonRecord, parseJsonObject } from "./json-tree.js";
import { unflattenEntries } from "./unflatten.js";

/** Per-value placeholder extraction, exposed on the adapter for consumers. */
type ExtractPlaceholders = (value: string) => readonly string[];

/** Derives the keys whose values are invalid for the format's message syntax. */
type ComputeInvalidIcuKeys = (entries: ReadonlyMap<string, TranslationEntry>) => readonly string[];

/** Validates a single value against the format's message syntax (one value, before write). */
type ValidateMessage = (value: string) => boolean;

/** Optional check on the parsed tree before flattening (for example, reject mixed structure). */
type ValidateTree = (tree: JsonRecord) => void;

/** Optional builder for the object to write, allowing formats to control on-disk structure. */
type BuildWriteTree = (
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
) => unknown | Promise<unknown>;

export interface JsonFileAdapterOptions {
  readonly format: SupportedFormat;
  readonly deriveEntry: DeriveEntry;
  readonly extractPlaceholders: ExtractPlaceholders;
  /** Optional; formats without ICU (i18next, vue-i18n) omit it and report none. */
  readonly computeInvalidIcuKeys?: ComputeInvalidIcuKeys;
  /**
   * Optional per-value message validator. Formats without ICU omit it and every value is valid;
   * ICU formats supply the same total check `computeInvalidIcuKeys` runs, applied to one value.
   */
  readonly validateMessage?: ValidateMessage;
  /** Optional; runs on the parsed tree before flattening (defaults to no check). */
  readonly validateTree?: ValidateTree;
  /** Optional; builds the object to write (defaults to nested via unflattenEntries). */
  readonly buildWriteTree?: BuildWriteTree;
}

function namespaceOf(filePath: string): string {
  return basename(filePath, extname(filePath));
}

function canHandle(filePath: string, sample?: string): boolean {
  if (extname(filePath).toLowerCase() !== ".json") {
    return false;
  }
  return sample === undefined || sample.trimStart().startsWith("{");
}

/**
 * Rethrow an existing structured `AdapterError` unchanged, or convert any other throw
 * into one so boundary failures never escape `read` as a raw error.
 */
function rethrowStructured(error: unknown, message: string): never {
  if (error instanceof AdapterError) {
    throw error;
  }
  throw new AdapterError("INVALID_STRUCTURE", message);
}

function toEntries(
  content: string,
  namespace: string,
  deriveEntry: DeriveEntry,
  validateTree?: ValidateTree,
): Map<string, TranslationEntry> {
  try {
    const tree = parseJsonObject(content);
    validateTree?.(tree);
    return flattenTree(tree, namespace, deriveEntry);
  } catch (error) {
    rethrowStructured(error, "The file could not be read as JSON.");
  }
}

/**
 * Compute the format's invalid-message keys inside the structured-error wrap. The only
 * current analyzer (next-intl) is total, but wrapping keeps a future non-total analyzer
 * from leaking a raw error out of `read`.
 */
function computeIcu(
  entries: ReadonlyMap<string, TranslationEntry>,
  compute?: ComputeInvalidIcuKeys,
): readonly string[] {
  if (!compute) {
    return [];
  }
  try {
    return compute(entries);
  } catch (error) {
    rethrowStructured(error, "The file could not be analyzed for message validity.");
  }
}

/**
 * Build a JSON {@link FormatAdapter} from format-specific behavior. This is the shared shell every
 * JSON adapter (i18next, vue-i18n, next-intl, ngx-translate) is built on, and the in-repo lever for
 * adding a new JSON-family format: supply the format-specific parts and the shell provides detection,
 * the bounded TOCTOU-safe read, structured errors, and the atomic order-preserving write.
 *
 * The returned adapter's methods throw as follows. `read` raises {@link AdapterError} with
 * `INVALID_JSON` (content is not valid JSON), `MAX_DEPTH_EXCEEDED` (nesting exceeds the depth cap),
 * `INVALID_STRUCTURE` (the path is not a regular file, the root is not a JSON object, a leaf is not a
 * string, or a supplied hook throws a non-AdapterError), or `INPUT_TOO_LARGE` (the file exceeds the
 * size cap), plus any `AdapterError` a supplied `validateTree` raises (for example, ngx-translate's
 * `MIXED_STRUCTURE`). A missing or unopenable path instead rejects with the underlying filesystem
 * error. `write` raises `AdapterError` `INVALID_STRUCTURE` when a leaf key collides with a nested key
 * path, and rejects with the underlying filesystem error on a write failure.
 *
 * @param options - The format-specific behavior: the `format` tag, `deriveEntry` (placeholders and
 *   plurality per leaf), `extractPlaceholders`, and the optional `computeInvalidIcuKeys`,
 *   `validateTree`, and `buildWriteTree` hooks.
 * @returns A ready-to-register `FormatAdapter` for the given format.
 * @example
 * ```ts
 * // `format` must be a SupportedFormat from core. To add a brand-new format, extend core's
 * // SupportedFormat enum first; here we reuse an existing one for illustration.
 * export function createMyJsonAdapter(): FormatAdapter {
 *   const extract = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[0]);
 *   return createJsonFileAdapter({
 *     format: "i18next-json",
 *     extractPlaceholders: extract,
 *     deriveEntry: (key, value) => ({ placeholders: extract(value), isPlural: key.endsWith("_other") }),
 *     // optional: validateTree (reject a structure), computeInvalidIcuKeys (ICU formats),
 *     // buildWriteTree (a custom on-disk shape)
 *   });
 * }
 * ```
 */
export function createJsonFileAdapter(options: JsonFileAdapterOptions): FormatAdapter {
  const {
    format,
    deriveEntry,
    extractPlaceholders,
    computeInvalidIcuKeys,
    validateMessage,
    validateTree,
    buildWriteTree,
  } = options;
  return {
    format,
    canHandle,
    extractPlaceholders,
    // Non-ICU formats supply no validator: every value is valid for their syntax.
    validateMessage: validateMessage ?? ((): boolean => true),
    async read(filePath, locale): Promise<ReadResult> {
      const outcome = await readBounded(filePath);
      if (outcome.kind === "not-a-file") {
        throw new AdapterError("INVALID_STRUCTURE", "The path is not a regular file.");
      }
      if (outcome.kind === "too-large") {
        throw new AdapterError("INPUT_TOO_LARGE", "The file exceeds the maximum allowed size.");
      }
      const namespace = namespaceOf(filePath);
      const entries = toEntries(outcome.content, namespace, deriveEntry, validateTree);
      const resource: LocaleResource = { locale, namespace, format, entries };
      const invalidIcuKeys = computeIcu(entries, computeInvalidIcuKeys);
      return { resource, invalidIcuKeys };
    },
    async write(resource, filePath): Promise<void> {
      const tree = buildWriteTree
        ? await buildWriteTree(resource.entries, filePath)
        : unflattenEntries(resource.entries);
      await atomicWriteFile(filePath, `${JSON.stringify(tree, null, 2)}\n`);
    },
  };
}
