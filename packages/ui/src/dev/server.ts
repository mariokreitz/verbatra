/**
 * Local development entry point. Not built, not published, and never imported by src/index.ts.
 * Started with `tsx watch` from the package root, so the assets root is resolved relative to this
 * file's own on-disk location rather than the built dist/index.js default.
 */
import { startUiServer } from "../index.js";

const DEV_TOKEN_ENV_VAR = "VERBATRA_UI_DEV_TOKEN";
const FALLBACK_DEV_TOKEN = "verbatra-studio-dev";

async function main(): Promise<void> {
  const assetsRoot = new URL("../../dist/app/", import.meta.url);
  const token = process.env[DEV_TOKEN_ENV_VAR] ?? FALLBACK_DEV_TOKEN;

  const server = await startUiServer({ assetsRoot, token });

  console.log(`verbatra ui dev server listening at ${server.url}`);
}

void main();
