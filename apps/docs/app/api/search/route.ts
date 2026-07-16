import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

/** Docs search endpoint generated from the Fumadocs source. */
export const { GET } = createFromSource(source);
