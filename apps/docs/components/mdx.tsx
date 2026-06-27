import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { DiffPanel } from "@/components/diff-panel";
import { LaneCards, ReferenceRow, VMark } from "@/components/landing";
import Badge from "@/components/ui/badge";
import Card from "@/components/ui/card";
import CommandLine from "@/components/ui/command-line";
import Tabs from "@/components/ui/tabs";

// Merges Fumadocs UI defaults with verbatra's custom MDX components; the DS Tabs registers as <VTabs/> so it never shadows Fumadocs' built-in <Tabs/>.
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    DiffPanel,
    CommandLine,
    Badge,
    Card,
    VTabs: Tabs,
    LaneCards,
    ReferenceRow,
    VMark,
    ...components,
  };
}
