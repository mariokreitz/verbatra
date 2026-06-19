import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { DiffPanel } from "@/components/diff-panel";
import { CopyCommand, LaneCards, ReferenceRow, VMark } from "@/components/landing";

// Merge the Fumadocs UI defaults with verbatra's custom MDX components so pages can use
// <DiffPanel/>, the landing pieces, etc. without per-page imports.
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    DiffPanel,
    CopyCommand,
    LaneCards,
    ReferenceRow,
    VMark,
    ...components,
  };
}
