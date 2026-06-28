import type { ViteUserConfig } from "vitest/config";

/**
 * Per-package include and exclude globs for {@link createVitestConfig}; everything else is locked.
 */
export interface CreateVitestConfigOptions {
  /** Test file globs (default `["src/**\/*.test.ts"]`). */
  testInclude?: string[];
  /** Measured source globs (default `["src/**\/*.ts"]`). */
  coverageInclude?: string[];
  /** Extra excludes appended to the baked base excludes (default `[]`). */
  coverageExclude?: string[];
}

/**
 * Build the shared Vitest config: the locked coverage gate plus the per-package include and exclude
 * globs.
 *
 * @param options per-package include and exclude globs; everything else is locked.
 * @returns The resolved Vitest config for a package's `vitest.config.ts`.
 */
export declare function createVitestConfig(options?: CreateVitestConfigOptions): ViteUserConfig;
