import { z } from "zod";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { withGlossaryGuard } from "../lock/locale-write-lock.js";
import type { GlossaryProvenance } from "./resolve-glossary.js";

export const MAX_GLOSSARY_FILE_BYTES = 1024 * 1024;

const DEFAULT_INDENT = "  ";

const INDENT_PATTERN = /^([ \t]+)"/m;

const BOM = "\uFEFF";
const REPLACEMENT_CHARACTER = "\uFFFD";
const NUL = "\u0000";

const glossaryRecordSchema = z.record(z.string(), z.string());

interface GlossaryDocument {
  readonly entries: Readonly<Record<string, string>>;
  readonly indent: string;
  readonly trailingNewline: string;
}

function stripBom(content: string): string {
  return content.startsWith(BOM) ? content.slice(BOM.length) : content;
}

function looksLikeInvalidEncoding(content: string): boolean {
  return content.startsWith(REPLACEMENT_CHARACTER) || content.includes(NUL);
}

function detectIndent(content: string): string {
  return INDENT_PATTERN.exec(content)?.[1] ?? DEFAULT_INDENT;
}

async function readGlossaryDocument(path: string, fs: SdkFs): Promise<GlossaryDocument> {
  const read = await fs.readFileBounded(path, MAX_GLOSSARY_FILE_BYTES);
  if (read.kind === "missing") {
    throw new SdkError(
      "CONFIG_INVALID",
      `The glossary file at ${path} was not found or could not be read.`,
    );
  }
  if (read.kind === "too-large") {
    throw new SdkError(
      "CONFIG_INVALID",
      `The glossary file at ${path} exceeds the maximum allowed size of ${MAX_GLOSSARY_FILE_BYTES} bytes.`,
    );
  }

  const content = stripBom(read.content);
  if (looksLikeInvalidEncoding(content)) {
    throw new SdkError("CONFIG_INVALID", `The glossary file at ${path} must be UTF-8 encoded.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new SdkError("CONFIG_INVALID", `The glossary file at ${path} is not valid JSON.`);
  }

  const result = glossaryRecordSchema.safeParse(parsed);
  if (!result.success) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The glossary file at ${path} must contain a flat object of string keys to string values.`,
    );
  }
  return {
    entries: result.data,
    indent: detectIndent(content),
    trailingNewline: content.endsWith("\n") ? "\n" : "",
  };
}

export async function readGlossaryRecord(
  path: string,
  fs: SdkFs,
): Promise<Readonly<Record<string, string>>> {
  return (await readGlossaryDocument(path, fs)).entries;
}

function glossaryFilePath(glossary: GlossaryProvenance): string {
  if (glossary.source !== "file") {
    throw new SdkError(
      "GLOSSARY_NOT_FILE_BACKED",
      `The glossary is ${glossary.source === "inline" ? "written inline in the config" : "not configured"}, so there is no glossary file to work with. Point the config's glossary at a JSON file first.`,
    );
  }
  return glossary.path;
}

function assertWritableTerm(term: string, translation: string | null): void {
  if (term.trim().length === 0) {
    throw new SdkError("CONFIG_INVALID", "A glossary term must not be blank.");
  }
  if (translation !== null && translation.trim().length === 0) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The translation for the glossary term "${term}" must not be blank. Remove the term instead.`,
    );
  }
}

function applyTerm(
  current: Readonly<Record<string, string>>,
  term: string,
  translation: string | null,
): Readonly<Record<string, string>> {
  const pairs = Object.entries(current);
  const index = pairs.findIndex(([existing]) => existing === term);
  if (translation === null) {
    if (index >= 0) {
      pairs.splice(index, 1);
    }
  } else if (index >= 0) {
    pairs[index] = [term, translation];
  } else {
    pairs.push([term, translation]);
  }
  return Object.fromEntries(pairs);
}

function serializeGlossary(
  entries: Readonly<Record<string, string>>,
  document: GlossaryDocument,
  path: string,
): string {
  const serialized = `${JSON.stringify(entries, null, document.indent)}${document.trailingNewline}`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_GLOSSARY_FILE_BYTES) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The updated glossary file at ${path} would exceed the maximum allowed size of ${MAX_GLOSSARY_FILE_BYTES} bytes.`,
    );
  }
  return serialized;
}

async function writeGlossary(path: string, serialized: string, fs: SdkFs): Promise<void> {
  try {
    await fs.writeFile(path, serialized);
  } catch (error) {
    throw new SdkError(
      "GLOSSARY_UNWRITABLE",
      `The glossary file at ${path} could not be written: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Input for {@link readGlossaryFile} and {@link updateGlossaryTerm}. */
export interface GlossaryFileInput {
  /**
   * Where the loaded config's glossary came from, as reported by {@link loadConfigWithMeta}. Only a
   * `file` provenance is accepted; it also carries the path, which is why neither function takes one.
   */
  readonly glossary: GlossaryProvenance;
}

/** Input for {@link updateGlossaryTerm}. */
export interface UpdateGlossaryTermInput extends GlossaryFileInput {
  /** Directory the write lock is taken under. Defaults to the process working directory. */
  readonly cwd?: string;
  /** The source term to add, replace, or remove. Must not be blank. */
  readonly term: string;
  /** The translation to store for the term, or `null` to remove the term. Must not be blank. */
  readonly translation: string | null;
}

/** Injectable dependencies for {@link readGlossaryFile} and {@link updateGlossaryTerm}. */
export interface GlossaryFileDeps {
  /** File-system port. Defaults to the real file system. */
  readonly fs?: SdkFs;
}

/**
 * Reads a file-backed glossary fresh from disk, under the same validation {@link loadConfig} applies
 * when it resolves a glossary path. Use it when a long-running tool has to show the glossary as it
 * is now rather than as it was when the config was loaded.
 *
 * The file to read comes from the provenance itself, so there is no way to point this at a file the
 * loaded config does not name.
 *
 * @param input - The glossary provenance from a loaded config.
 * @param deps - Optional file-system override.
 * @returns The glossary as a flat term map.
 *
 * @throws {@link SdkError} `GLOSSARY_NOT_FILE_BACKED`: the config's glossary is inline or absent, so
 * there is no file to read.
 * @throws {@link SdkError} `CONFIG_INVALID`: the glossary file is missing, oversized, not UTF-8, not
 * valid JSON, or not a flat object of string keys to string values.
 */
export async function readGlossaryFile(
  input: GlossaryFileInput,
  deps: GlossaryFileDeps = {},
): Promise<Readonly<Record<string, string>>> {
  return readGlossaryRecord(glossaryFilePath(input.glossary), deps.fs ?? defaultFs);
}

/**
 * Adds, replaces, or removes one term in a file-backed glossary, rewriting the JSON file in place.
 * This is the write path behind a glossary editor: one term changes and the rest of the file keeps
 * its order and its indentation.
 *
 * Only a file-backed glossary can be edited. An inline glossary lives inside the config module,
 * which is executable code this function will not rewrite, and no glossary at all has no file to
 * write to; both are refused rather than converted.
 *
 * The whole read-modify-write runs under a project-wide glossary lock, so two concurrent edits are
 * serialized rather than interleaved, and the file itself is replaced atomically. The result is
 * validated to stay within the same size limit {@link loadConfig} enforces when it reads a glossary
 * file back, so an accepted write is always re-readable.
 *
 * @param input - The glossary provenance, the term, and its new translation or `null` to remove it.
 * @param deps - Optional file-system override.
 * @returns The glossary as it now stands on disk.
 *
 * @throws {@link SdkError} `GLOSSARY_NOT_FILE_BACKED`: the config's glossary is inline or absent, so
 * there is no file to write.
 * @throws {@link SdkError} `CONFIG_INVALID`: the term or its translation is blank, the glossary file
 * on disk is missing, oversized, not UTF-8, not valid JSON, or not a flat object of string keys to
 * string values, or the updated glossary would exceed the maximum glossary file size.
 * @throws {@link SdkError} `LOCK_CONTENDED`: the project's glossary write lock could not be acquired
 * before the timeout elapsed.
 * @throws {@link SdkError} `GLOSSARY_UNWRITABLE`: the glossary file could not be written.
 *
 * @example
 * ```ts
 * import { loadConfigWithMeta, updateGlossaryTerm } from "@verbatra/sdk";
 *
 * const loaded = await loadConfigWithMeta({ cwd: process.cwd() });
 * const glossary = await updateGlossaryTerm({
 *   glossary: loaded.glossary,
 *   cwd: process.cwd(),
 *   term: "Verbatra",
 *   translation: "Verbatra",
 * });
 *
 * console.log(Object.keys(glossary).length);
 * ```
 */
export async function updateGlossaryTerm(
  input: UpdateGlossaryTermInput,
  deps: GlossaryFileDeps = {},
): Promise<Readonly<Record<string, string>>> {
  const path = glossaryFilePath(input.glossary);
  assertWritableTerm(input.term, input.translation);
  const fs = deps.fs ?? defaultFs;
  const cwd = input.cwd ?? process.cwd();

  return withGlossaryGuard(cwd, fs, async () => {
    const document = await readGlossaryDocument(path, fs);
    const entries = applyTerm(document.entries, input.term, input.translation);
    await writeGlossary(path, serializeGlossary(entries, document, path), fs);
    return entries;
  });
}
