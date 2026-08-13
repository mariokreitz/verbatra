import { resolve } from "node:path";
import { z } from "zod";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";

export const MAX_GLOSSARY_FILE_BYTES = 1024 * 1024;

const glossaryRecordSchema = z.record(z.string(), z.string());

export type GlossaryProvenance =
  | { readonly source: "none" }
  | { readonly source: "inline" }
  | { readonly source: "file"; readonly path: string };

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

function looksLikeInvalidEncoding(content: string): boolean {
  return content.startsWith(REPLACEMENT_CHARACTER) || content.includes(NUL);
}

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
