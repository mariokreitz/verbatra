import { resolve } from "node:path";
import { z } from "zod";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";

/** Size cap for a glossary file read: bounded so a huge file cannot exhaust memory. */
export const MAX_GLOSSARY_FILE_BYTES = 1024 * 1024;

const glossaryRecordSchema = z.record(z.string(), z.string());

/** Where a config's resolved glossary came from: absent, inline, or a file at the recorded path. */
export type GlossaryProvenance =
  | { readonly source: "none" }
  | { readonly source: "inline" }
  | { readonly source: "file"; readonly path: string };

/** The result of resolving a config's `glossary` field: the plain record plus its provenance. */
export interface ResolvedGlossary {
  readonly glossary: Readonly<Record<string, string>> | undefined;
  readonly provenance: GlossaryProvenance;
}

const BOM = "\uFEFF";
const REPLACEMENT_CHARACTER = "\uFFFD";
const NUL = "\u0000";

function stripBom(content: string): string {
  return content.startsWith(BOM) ? content.slice(BOM.length) : content;
}

/**
 * Whether the decoded content betrays a non-UTF-8 source file: a file decoded as UTF-8 that was not
 * actually UTF-8 (for example UTF-16) either starts with the decoder's replacement character or
 * carries embedded NUL bytes from interleaved zero code units.
 */
function looksLikeInvalidEncoding(content: string): boolean {
  return content.startsWith(REPLACEMENT_CHARACTER) || content.includes(NUL);
}

/**
 * Read and validate one glossary JSON file through the bounded fs seam. Duplicate JSON keys resolve
 * last-wins, as `JSON.parse` leaves them. Every failure is a `CONFIG_INVALID` naming the path.
 */
async function readGlossaryFile(
  resolvedPath: string,
  fs: SdkFs,
): Promise<Readonly<Record<string, string>>> {
  const read = await fs.readFileBounded(resolvedPath, MAX_GLOSSARY_FILE_BYTES);
  if (read.kind === "missing") {
    throw new SdkError(
      "CONFIG_INVALID",
      `The glossary file at ${resolvedPath} was not found or could not be read.`,
    );
  }
  if (read.kind === "too-large") {
    throw new SdkError(
      "CONFIG_INVALID",
      `The glossary file at ${resolvedPath} exceeds the maximum allowed size of ${MAX_GLOSSARY_FILE_BYTES} bytes.`,
    );
  }

  const content = stripBom(read.content);
  if (looksLikeInvalidEncoding(content)) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The glossary file at ${resolvedPath} must be UTF-8 encoded.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new SdkError("CONFIG_INVALID", `The glossary file at ${resolvedPath} is not valid JSON.`);
  }

  const result = glossaryRecordSchema.safeParse(parsed);
  if (!result.success) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The glossary file at ${resolvedPath} must contain a flat object of string keys to string values.`,
    );
  }
  return result.data;
}

/**
 * Resolve a config's `glossary` field into a plain record and its provenance. An inline record passes
 * through unchanged; a string is treated as a path to a JSON file holding the same shape, read through
 * the bounded {@link SdkFs} seam and validated with the same record schema as the inline form. A
 * relative path resolves against `baseDir`.
 *
 * @param glossary - The as-parsed `glossary` field: absent, an inline record, or a file path.
 * @param baseDir - The directory a relative file path resolves against (the config file's directory, or
 *   `cwd` for a `configOverride`).
 * @param fs - The bounded file-system seam.
 * @throws {@link SdkError} `CONFIG_INVALID` naming the resolved path: the file is missing, unreadable,
 *   over the size cap, not UTF-8, not valid JSON, or not a flat string record.
 */
export async function resolveGlossary(
  glossary: Readonly<Record<string, string>> | string | undefined,
  baseDir: string,
  fs: SdkFs,
): Promise<ResolvedGlossary> {
  if (glossary === undefined) {
    return { glossary: undefined, provenance: { source: "none" } };
  }
  if (typeof glossary === "string") {
    const resolvedPath = resolve(baseDir, glossary);
    const record = await readGlossaryFile(resolvedPath, fs);
    return { glossary: record, provenance: { source: "file", path: resolvedPath } };
  }
  return { glossary, provenance: { source: "inline" } };
}
