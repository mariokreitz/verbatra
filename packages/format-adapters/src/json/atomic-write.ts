import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface AtomicWriteOps {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, data: string): Promise<void>;
  fsyncFile(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  fsyncDir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
}

async function fsyncPath(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncDirBestEffort(path: string): Promise<void> {
  try {
    await fsyncPath(path);
  } catch {}
}

const nodeOps: AtomicWriteOps = {
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  writeFile: (path, data) => writeFile(path, data, "utf8"),
  fsyncFile: (path) => fsyncPath(path),
  rename: (from, to) => rename(from, to),
  fsyncDir: (path) => fsyncDirBestEffort(path),
  rm: (path) => rm(path, { force: true }),
};

async function cleanup(ops: AtomicWriteOps, tmp: string): Promise<void> {
  try {
    await ops.rm(tmp);
  } catch {}
}

export function tempFileName(path: string): string {
  return join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`);
}

export async function atomicWriteFile(
  path: string,
  data: string,
  ops: AtomicWriteOps = nodeOps,
): Promise<void> {
  const directory = dirname(path);
  const tmp = tempFileName(path);
  try {
    await ops.mkdir(directory);
    await ops.writeFile(tmp, data);
    await ops.fsyncFile(tmp);
    await ops.rename(tmp, path);
  } catch (error) {
    await cleanup(ops, tmp);
    throw error;
  }
  try {
    await ops.fsyncDir(directory);
  } catch {}
}
