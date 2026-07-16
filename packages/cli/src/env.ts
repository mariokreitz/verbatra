import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/** Applies each value only when the key is unset, so a real environment variable is never replaced. */
function applyIfUnset(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Parses one env file. A missing file yields an empty object; any other read error propagates. */
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
 * Loads .env files into process.env. Precedence, highest wins: real process.env > .env.local > .env.
 * Missing, empty, or comment-only files are a no-op.
 *
 * @param cwd - The directory the .env files are resolved against.
 * @throws A non-ENOENT read error (for example a directory named .env) propagates unchanged.
 */
export function loadEnvFiles(cwd: string): void {
  applyIfUnset(parseEnvFile(resolve(cwd, ".env.local")));
  applyIfUnset(parseEnvFile(resolve(cwd, ".env")));
}
