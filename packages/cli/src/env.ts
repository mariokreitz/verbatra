import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

// Apply parsed values to process.env only when the key is not already set, so a variable that is
// already present in the real environment is never replaced.
function applyIfUnset(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Parse one env file without side effects. A missing file is a silent no-op; any other read error
// (for example the path being a directory) propagates. Node's parser handles the .env grammar;
// parseEnv yields concrete string values, so its NodeJS.Dict<string> result is narrowed here.
function parseEnvFile(filePath: string): Record<string, string> {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
  return parseEnv(content) as Record<string, string>;
}

/**
 * Load .env files from the resolved working directory into process.env. Precedence, highest wins:
 * real process.env > .env.local > .env. Applying only-if-unset in the order .env.local then .env
 * means a variable already in process.env is never replaced and .env.local wins over .env. Missing,
 * empty, or comment-only files are a no-op. The CLI populates the environment; the SDK then reads
 * process.env unchanged. This function writes to no stream and surfaces no value.
 *
 * @param cwd - The working directory the .env files are resolved against.
 */
export function loadEnvFiles(cwd: string): void {
  applyIfUnset(parseEnvFile(resolve(cwd, ".env.local")));
  applyIfUnset(parseEnvFile(resolve(cwd, ".env")));
}
