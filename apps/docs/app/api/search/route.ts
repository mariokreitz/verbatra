import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Static, build-time search index over the docs content. No external service.
export const { GET } = createFromSource(source);
