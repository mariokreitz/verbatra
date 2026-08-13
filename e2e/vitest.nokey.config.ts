import { defaultExclude, defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [...defaultExclude, "tests/**/*.live.e2e.test.ts"],
    },
  }),
);
