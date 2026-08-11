import { join } from "node:path";
import type { DelimitedFormat } from "@verbatra/exchange";
import { z } from "zod";
import type { SdkFs } from "../../fs.js";

/** The manifest schema version, bumped only when the recorded shape changes meaning. */
const MANIFEST_VERSION = 1;

/**
 * Size cap for the manifest read. The file is small by construction, sits in a directory a translator
 * hands back, and is therefore untrusted like every other input read here.
 */
const MAX_MANIFEST_BYTES = 1024 * 1024;

/**
 * The manifest's file name for one delimited format. One manifest per format, so exporting `csv` and
 * `tsv` into the same directory keeps two independent records instead of one overwriting the other.
 * Hidden and tool-branded, so it neither clutters the handoff a translator sees nor collides with a
 * plausible file of the user's own.
 */
export function exportManifestFileName(format: DelimitedFormat): string {
  return `.verbatra-export-${format}.json`;
}

const manifestSchema = z.object({
  version: z.number().int().positive(),
  format: z.enum(["csv", "tsv"]),
  locales: z.array(z.string()),
});

/**
 * Record which locales the export just wrote into the directory. Import reads it back to tell a file
 * this export produced from one an earlier, wider export left behind: nothing in a delimited file, its
 * name, or its timestamp says which run produced it, so the export has to say so itself.
 *
 * Written after the locale files, never before: a run that dies midway leaves the previous manifest in
 * place rather than a half-truth of its own. That covers a re-export whose locale selection is a
 * superset of the last one, where the old manifest still names every file present. It does not cover a
 * narrower or disjoint re-export: exporting `[de]` and then dying partway through an export of `[fr]`
 * leaves a fresh `fr` file behind a manifest that names only `de`, and the next import refuses that
 * fresh file as `HANDOFF_FILE_STALE`. The failure is loud rather than silent (the locale is reported,
 * never applied outdated), and re-exporting clears it by rewriting both the files and the manifest.
 */
export async function writeExportManifest(
  fs: SdkFs,
  directory: string,
  format: DelimitedFormat,
  locales: readonly string[],
): Promise<void> {
  const manifest = { version: MANIFEST_VERSION, format, locales: [...locales] };
  await fs.writeFile(
    join(directory, exportManifestFileName(format)),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

/**
 * The locales the most recent export into this directory wrote, or `undefined` when that is not
 * knowable: no manifest (a directory from an older verbatra, one assembled by hand, or one round-tripped
 * through an archive that dropped the hidden file), an unreadable or oversized one, or one whose content
 * is not a manifest for this format. `undefined` means "make no claim", and the caller then reads every
 * locale file present, exactly as it did before manifests existed. Being unable to prove a file stale
 * must never turn into withholding a translator's work.
 */
export async function readExportedLocales(
  fs: SdkFs,
  directory: string,
  format: DelimitedFormat,
): Promise<ReadonlySet<string> | undefined> {
  const read = await fs.readFileBounded(
    join(directory, exportManifestFileName(format)),
    MAX_MANIFEST_BYTES,
  );
  if (read.kind !== "ok") {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.content);
  } catch {
    return undefined;
  }
  const result = manifestSchema.safeParse(parsed);
  if (
    !result.success ||
    result.data.version !== MANIFEST_VERSION ||
    result.data.format !== format
  ) {
    return undefined;
  }
  return new Set(result.data.locales);
}
