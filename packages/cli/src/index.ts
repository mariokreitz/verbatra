import process from "node:process";
import {
  check,
  diff,
  doctor,
  exportWorkbook,
  importWorkbook,
  loadConfigWithMeta,
  resolveProjectConfig,
  translate,
  watch,
} from "@verbatra/sdk";
import { run } from "./run.js";

const code = await run(
  process.argv.slice(2),
  {
    resolveConfig: resolveProjectConfig,
    translate,
    watch,
    exportWorkbook,
    importWorkbook,
    check,
    diff,
    doctor,
    loadConfigWithMeta,
    importStudio: () => import("@verbatra/studio"),
  },
  {
    out: (text) => {
      process.stdout.write(text);
    },
    err: (text) => {
      process.stderr.write(text);
    },
  },
  {
    onWatchSession: (session) => {
      process.on("SIGINT", () => session.requestStop());
      process.on("SIGTERM", () => session.requestStop());
    },
    onStudioSession: (session) => {
      process.on("SIGINT", () => session.requestStop());
      process.on("SIGTERM", () => session.requestStop());
    },
  },
);

process.exit(code);
