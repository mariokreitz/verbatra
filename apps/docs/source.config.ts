import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
  // includeProcessedMarkdown exposes page.data.getText("processed"), the clean rendered
  // Markdown used by the /llms-full.txt route to serve the full corpus to AI agents.
  docs: {
    postprocess: { includeProcessedMarkdown: true },
  },
});

export default defineConfig();
