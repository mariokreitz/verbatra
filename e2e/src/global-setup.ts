import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const e2eDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(e2eDir, "..");
const manifestPath = join(e2eDir, ".tarballs.json");

async function findTarball(dir: string, prefix: string): Promise<string> {
  const entries = await readdir(dir);
  const match = entries.find((name) => name.startsWith(prefix) && name.endsWith(".tgz"));
  if (!match) {
    throw new Error(`No tarball matching ${prefix}*.tgz in ${dir}`);
  }
  return join(dir, match);
}

/**
 * Build `@verbatra/sdk`, `@verbatra/cli`, and their workspace dependencies before packing, scoped to
 * just that subgraph (not the whole monorepo). CI never takes this path: it sets the three
 * `VERBATRA_*_TARBALL` variables after running its own `pnpm build`, so this only guards a local
 * `npm test` run in `e2e/`, which would otherwise pack whatever `dist/` happens to be on disk
 * (stale or absent) instead of the current source.
 *
 * `@verbatra/studio` needs no filter of its own: it is a devDependency of `@verbatra/cli`, so
 * `--filter=@verbatra/cli...` already builds it, prebuilt SPA included.
 */
async function buildPackables(): Promise<void> {
  await execa(
    "pnpm",
    ["turbo", "run", "build", "--filter=@verbatra/sdk...", "--filter=@verbatra/cli..."],
    { cwd: repoRoot },
  );
}

/** The tarball override variables, in the order they are reported when only some are set. */
const TARBALL_ENV_VARS = [
  "VERBATRA_SDK_TARBALL",
  "VERBATRA_CLI_TARBALL",
  "VERBATRA_STUDIO_TARBALL",
] as const;

/**
 * Resolves the sdk, cli, and studio tarballs: from the three `VERBATRA_*_TARBALL` variables when
 * all are set (the CI path), otherwise by building the publishable subgraph and running `pnpm pack`
 * into a temp directory.
 *
 * Studio is packed alongside the other two so the `studio` command can be driven through the same
 * published-package boundary as every other command. It is installed only into the consumers that
 * ask for it, so the rest of the suite is unaffected.
 *
 * @throws When some but not all of the override variables are set.
 */
async function packTarballs(): Promise<{ sdk: string; cli: string; studio: string }> {
  const set = TARBALL_ENV_VARS.filter((name) => process.env[name]);
  if (set.length === TARBALL_ENV_VARS.length) {
    return {
      sdk: resolve(process.env.VERBATRA_SDK_TARBALL as string),
      cli: resolve(process.env.VERBATRA_CLI_TARBALL as string),
      studio: resolve(process.env.VERBATRA_STUDIO_TARBALL as string),
    };
  }
  if (set.length > 0) {
    throw new Error(
      `${TARBALL_ENV_VARS.join(", ")} must all be set or all be unset. Only ${set.join(", ")} ` +
        "was provided, which is more likely a misconfiguration than an intentional partial override.",
    );
  }

  await buildPackables();

  const dest = await mkdtemp(join(tmpdir(), "verbatra-e2e-packs-"));
  const pack = (filter: string) =>
    execa("pnpm", ["--filter", filter, "pack", "--pack-destination", dest], { cwd: repoRoot });
  await pack("@verbatra/sdk");
  await pack("@verbatra/cli");
  await pack("@verbatra/studio");
  return {
    sdk: await findTarball(dest, "verbatra-sdk-"),
    cli: await findTarball(dest, "verbatra-cli-"),
    studio: await findTarball(dest, "verbatra-studio-"),
  };
}

/**
 * Vitest global setup: packs (or resolves) the tarballs once per run and writes their paths to
 * `e2e/.tarballs.json` for the harness's `readTarballs` to consume.
 */
export async function setup(): Promise<void> {
  const tarballs = await packTarballs();
  await writeFile(manifestPath, JSON.stringify(tarballs, null, 2));
}
