import process from "node:process";
import { loadConfig, translate, watch } from "@verbatra/sdk";
import { run } from "./run.js";

// The bin shim: the ONLY part touching process global state. It wires the real SDK, the real
// process streams, the SIGINT/SIGTERM handlers, and maps the core's returned code to process.exit.
// Kept tiny and coverage-excluded, like the SDK's wiring.ts and the providers' client.ts seams.
const code = await run(
  process.argv.slice(2),
  { loadConfig, translate, watch },
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
  },
);

process.exit(code);
