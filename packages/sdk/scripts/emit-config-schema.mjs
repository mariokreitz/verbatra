#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { verbatraConfigSchema } = await import(resolve(PACKAGE_ROOT, "dist/index.js"));

const document = z.toJSONSchema(verbatraConfigSchema);
const target = resolve(PACKAGE_ROOT, "dist/config-schema.json");

writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.log(
  `emit-config-schema: wrote dist/config-schema.json (${Object.keys(document).length} top-level keys).`,
);
