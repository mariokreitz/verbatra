import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

export interface AtomicWriteOps {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, data: string): Promise<void>;
  fsyncFile(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  fsyncDir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
}

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
  ops: AtomicWriteOps,
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
