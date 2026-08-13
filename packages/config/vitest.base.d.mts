import type { ViteUserConfig } from "vitest/config";

export interface CreateVitestConfigOptions {
  testInclude?: string[];
  coverageInclude?: string[];
  coverageExclude?: string[];
}

export declare function createVitestConfig(options?: CreateVitestConfigOptions): ViteUserConfig;
