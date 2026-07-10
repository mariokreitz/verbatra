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
 * just that subgraph (not the whole monorepo). CI never takes this path: it sets
 * `VERBATRA_SDK_TARBALL`/`VERBATRA_CLI_TARBALL` after running its own `pnpm build`, so this only
 * guards a local `npm test` run in `e2e/`, which would otherwise pack whatever `dist/` happens to be
 * on disk (stale or absent) instead of the current source.
 */
async function buildPackables(): Promise<void> {
  await execa(
    "pnpm",
    ["turbo", "run", "build", "--filter=@verbatra/sdk...", "--filter=@verbatra/cli..."],
    { cwd: repoRoot },
  );
}

async function packTarballs(): Promise<{ sdk: string; cli: string }> {
  const envSdk = process.env.VERBATRA_SDK_TARBALL;
  const envCli = process.env.VERBATRA_CLI_TARBALL;
  if (envSdk && envCli) {
    return { sdk: resolve(envSdk), cli: resolve(envCli) };
  }
  if (envSdk || envCli) {
    throw new Error(
      "VERBATRA_SDK_TARBALL and VERBATRA_CLI_TARBALL must both be set or both be unset. " +
        "Only one was provided, which is more likely a misconfiguration than an intentional partial override.",
    );
  }

  await buildPackables();

  const dest = await mkdtemp(join(tmpdir(), "verbatra-e2e-packs-"));
  const pack = (filter: string) =>
    execa("pnpm", ["--filter", filter, "pack", "--pack-destination", dest], { cwd: repoRoot });
  await pack("@verbatra/sdk");
  await pack("@verbatra/cli");
  return {
    sdk: await findTarball(dest, "verbatra-sdk-"),
    cli: await findTarball(dest, "verbatra-cli-"),
  };
}

export async function setup(): Promise<void> {
  const tarballs = await packTarballs();
  await writeFile(manifestPath, JSON.stringify(tarballs, null, 2));
}
