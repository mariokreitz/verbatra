import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const SELF_ALIASED_PACKAGES = ["@verbatra/sdk", "@verbatra/cli"] as const;

const ENTRY_CONDITION_ORDER = ["import", "node", "default", "require"] as const;

interface PackageExportsConditions {
  readonly import?: string;
  readonly node?: string;
  readonly default?: string;
  readonly require?: string;
}

interface PackageManifest {
  readonly main?: string;
  readonly exports?: string | Record<string, string | PackageExportsConditions>;
}

export interface ModuleAliasDeps {
  readonly resolvePaths: (packageName: string) => readonly string[];
  readonly readPackageManifest: (packageRoot: string) => PackageManifest | undefined;
}

function resolvePathsFromRunningModule(packageName: string): readonly string[] {
  return createRequire(import.meta.url).resolve.paths(packageName) ?? [];
}

function readPackageManifestFromDisk(packageRoot: string): PackageManifest | undefined {
  try {
    return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as PackageManifest;
  } catch {
    return undefined;
  }
}

export const defaultModuleAliasDeps: ModuleAliasDeps = {
  resolvePaths: resolvePathsFromRunningModule,
  readPackageManifest: readPackageManifestFromDisk,
};

function resolveRootExportPath(manifest: PackageManifest): string | undefined {
  const exportsField = manifest.exports;
  if (typeof exportsField === "string") {
    return exportsField;
  }
  if (typeof exportsField === "object" && exportsField !== null) {
    const rootExport = exportsField["."];
    if (typeof rootExport === "string") {
      return rootExport;
    }
    if (typeof rootExport === "object" && rootExport !== null) {
      for (const condition of ENTRY_CONDITION_ORDER) {
        const candidate = rootExport[condition];
        if (typeof candidate === "string") {
          return candidate;
        }
      }
    }
  }
  return manifest.main;
}

function findPackageEntry(packageName: string, deps: ModuleAliasDeps): string | undefined {
  for (const candidateDir of deps.resolvePaths(packageName)) {
    const packageRoot = join(candidateDir, packageName);
    const manifest = deps.readPackageManifest(packageRoot);
    if (manifest === undefined) {
      continue;
    }
    const relativeEntry = resolveRootExportPath(manifest);
    if (relativeEntry !== undefined) {
      return join(packageRoot, relativeEntry);
    }
  }
  return undefined;
}

export function resolveSelfPackageAliases(
  deps: ModuleAliasDeps = defaultModuleAliasDeps,
): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const packageName of SELF_ALIASED_PACKAGES) {
    const entry = findPackageEntry(packageName, deps);
    if (entry !== undefined) {
      aliases[packageName] = entry;
    }
  }
  return aliases;
}
