/**
 * Local development entry point: starts the studio server against the
 * current working directory's verbatra config. Not built, not published, and
 * never imported by src/index.ts. The assets root resolves relative to this
 * file's own on-disk location, and the dev token comes from
 * VERBATRA_STUDIO_DEV_TOKEN with a fixed fallback.
 */
import { loadConfigWithMeta } from "@verbatra/sdk";
import { startStudioServer } from "../index.js";

const DEV_TOKEN_ENV_VAR = "VERBATRA_STUDIO_DEV_TOKEN";
const FALLBACK_DEV_TOKEN = "verbatra-studio-dev";

async function main(): Promise<void> {
  const assetsRoot = new URL("../../dist/app/", import.meta.url);
  const token = process.env[DEV_TOKEN_ENV_VAR] ?? FALLBACK_DEV_TOKEN;

  await startStudioServer({ assetsRoot, token, loader: () => loadConfigWithMeta() });
}

void main();
