"use client";

import { FrameworkProvider, type ImageProps } from "fumadocs-core/framework";
import NextImage from "next/image";
import NextLink from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { i18n } from "@/lib/i18n";

const DEFAULT_LOCALE_PREFIX = `/${i18n.defaultLanguage}`;

/**
 * Returns the pathname as the browser sees it.
 *
 * Pages for the default locale are prerendered under `/en/...` but served at
 * the prefix-free URL (`hideLocale: "default-locale"` plus the i18n proxy
 * rewrite), so Next's `usePathname` returns `/en/...` during server rendering
 * and `/...` after hydration. Every pathname-derived Fumadocs component
 * (breadcrumb, page footer, TOC popover, sidebar active state) then
 * mismatched and logged React error #418 on each docs page. Stripping the
 * default locale prefix yields the same value on both sides.
 */
function useVisiblePathname(): string {
  const pathname = usePathname();
  if (pathname === DEFAULT_LOCALE_PREFIX) return "/";
  if (pathname.startsWith(`${DEFAULT_LOCALE_PREFIX}/`)) {
    return pathname.slice(DEFAULT_LOCALE_PREFIX.length);
  }
  return pathname;
}

function FrameworkLink({ href, prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) {
  return <NextLink {...props} href={href ?? "#"} prefetch={prefetch} />;
}

function toDimension(value: string | number | undefined): number | undefined {
  if (typeof value !== "string") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function FrameworkImage({ src, alt, width, height, ...props }: ImageProps) {
  if (src === undefined) return null;
  return (
    <NextImage
      {...props}
      src={src}
      alt={alt ?? ""}
      width={toDimension(width)}
      height={toDimension(height)}
    />
  );
}

/**
 * Drop-in replacement for the Fumadocs Next framework provider that feeds
 * Fumadocs the locale-normalized pathname. Router, params, Link, and Image
 * behave exactly like the stock provider.
 */
export function LocaleAwareFrameworkProvider({ children }: { children: ReactNode }) {
  return (
    <FrameworkProvider
      usePathname={useVisiblePathname}
      useRouter={useRouter}
      useParams={useParams}
      Link={FrameworkLink}
      Image={FrameworkImage}
    >
      {children}
    </FrameworkProvider>
  );
}
