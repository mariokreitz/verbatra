import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { DiffPanel } from "@/components/diff-panel";
import {
  DocsHomeBody,
  DocsHomeFeatures,
  DocsHomeHero,
  DocsHomePaths,
} from "@/components/docs-home";
import { LaneCards, ReferenceRow, VMark } from "@/components/landing";
import Badge from "@/components/ui/badge";
import Card from "@/components/ui/card";
import CommandLine from "@/components/ui/command-line";
import Tabs from "@/components/ui/tabs";

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
    DocsHomeHero,
    DocsHomeBody,
    DocsHomePaths,
    DocsHomeFeatures,
    ...components,
  };
}
