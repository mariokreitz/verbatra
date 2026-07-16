import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/**
 * The docs content collection. includeProcessedMarkdown exposes
 * page.data.getText("processed"), the clean rendered Markdown the
 * /llms-full.txt route serves to AI agents.
 */
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: { includeProcessedMarkdown: true },
  },
});

export default defineConfig();
