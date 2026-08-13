import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
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
import { type Locale, localizeHref } from "@/lib/i18n";

export function getMDXComponents(locale: Locale, components?: MDXComponents): MDXComponents {
  const DefaultAnchor = defaultMdxComponents.a ?? "a";
  return {
    ...defaultMdxComponents,
    a: ({ href, ...rest }: ComponentProps<"a">) => (
      <DefaultAnchor href={localizeHref(locale, href)} {...rest} />
    ),
    DiffPanel,
    CommandLine,
    Badge,
    Card,
    VTabs: Tabs,
    LaneCards,
    ReferenceRow,
    VMark,
    DocsHomeHero: (props: Omit<ComponentProps<typeof DocsHomeHero>, "locale">) => (
      <DocsHomeHero {...props} locale={locale} />
    ),
    DocsHomeBody,
    DocsHomePaths: (props: Omit<ComponentProps<typeof DocsHomePaths>, "locale">) => (
      <DocsHomePaths {...props} locale={locale} />
    ),
    DocsHomeFeatures,
    ...components,
  };
}
