import { resolve } from "node:path";
import type { SdkFs } from "../fs.js";
import { readGlossaryRecord } from "./glossary-file.js";

/**
 * Where a loaded config's glossary came from, reported by {@link loadConfigWithMeta}. The resolved
 * {@link VerbatraConfig} holds only the final term map, so this is the one place a tool can tell an
 * inline glossary from one read out of a file, and name that file.
 */
export type GlossaryProvenance =
  | {
      /** The config declared no glossary. */
      readonly source: "none";
    }
  | {
      /** The glossary was written inline in the config as a term map. */
      readonly source: "inline";
    }
  | {
      /** The glossary was read from a JSON file the config pointed at. */
      readonly source: "file";
      /** The absolute path the glossary was read from. */
      readonly path: string;
    };

export interface ResolvedGlossary {
  readonly glossary: Readonly<Record<string, string>> | undefined;
  readonly provenance: GlossaryProvenance;
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
    const record = await readGlossaryRecord(resolvedPath, fs);
    return { glossary: record, provenance: { source: "file", path: resolvedPath } };
  }
  return { glossary, provenance: { source: "inline" } };
}
