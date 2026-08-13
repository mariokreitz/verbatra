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
