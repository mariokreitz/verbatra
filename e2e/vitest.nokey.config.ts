import { defaultExclude, defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.js";

/**
 * The deterministic tier: everything in the suite except the files that drive a real provider.
 *
 * The split is by file name rather than by a hand-maintained list of files to run, so a new
 * deterministic test is picked up by the required gate automatically. The previous list-based
 * script had the opposite default: a test added to the suite ran only in the live tier unless
 * someone remembered to add it, which is the failure mode that quietly shrinks a release gate.
 *
 * Live-tier files are named `*.live.e2e.test.ts`. They self-skip without a provider key, so this
 * exclusion is not what keeps them from running here; it is what keeps the tier boundary visible
 * in the file names instead of buried in a script argument.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [...defaultExclude, "tests/**/*.live.e2e.test.ts"],
    },
  }),
);
