import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { GITHUB_URL, NPM_CLI, NPM_SDK } from "./links";

type StatusBadge = {
  key: string;
  src: string;
  href: string;
  altKey: string;
};

// Shields query params that fit the dark theme: a dark label slot and the brand purple value.
const SHIELDS_BASE = "style=flat&labelColor=1b1b2b";
const SHIELDS_NPM = `${SHIELDS_BASE}&logo=npm&logoColor=white&color=9c27b0`;

// The GitHub Actions and Codecov endpoints ship their own SVG and ignore shields params; the
// other four are shields badges styled through query params. All values are sourced live.
const STATUS_BADGES: ReadonlyArray<StatusBadge> = [
  {
    key: "cli",
    src: `https://img.shields.io/npm/v/@verbatra/cli?label=%40verbatra%2Fcli&${SHIELDS_NPM}`,
    href: NPM_CLI,
    altKey: "cliVersionAlt",
  },
  {
    key: "sdk",
    src: `https://img.shields.io/npm/v/@verbatra/sdk?label=%40verbatra%2Fsdk&${SHIELDS_NPM}`,
    href: NPM_SDK,
    altKey: "sdkVersionAlt",
  },
  {
    key: "build",
    src: `${GITHUB_URL}/actions/workflows/ci.yml/badge.svg?branch=main`,
    href: `${GITHUB_URL}/actions/workflows/ci.yml`,
    altKey: "buildAlt",
  },
  {
    key: "coverage",
    src: "https://codecov.io/gh/mariokreitz/verbatra/graph/badge.svg",
    href: "https://codecov.io/gh/mariokreitz/verbatra",
    altKey: "coverageAlt",
  },
  {
    key: "downloads",
    src: `https://img.shields.io/npm/dm/@verbatra/cli?label=downloads%2Fmonth&${SHIELDS_NPM}`,
    href: NPM_CLI,
    altKey: "downloadsAlt",
  },
  {
    key: "license",
    src: `https://img.shields.io/badge/license-MIT-9c27b0?${SHIELDS_BASE}`,
    href: `${GITHUB_URL}/blob/main/LICENSE`,
    altKey: "licenseAlt",
  },
];

// Six linked, live-sourced trust badges. The "band" variant is a full-width ribbon; the
// "inline" variant is the centered trust row that sits inside the hero, below the CTAs.
// Static and presentational, so it stays a server component (the badges are live external
// images, not a runtime fetch).
export async function StatusBand({
  variant = "band",
}: {
  variant?: "band" | "inline";
}): Promise<ReactNode> {
  const t = await getTranslations("landing.status");
  const inline = variant === "inline";
  return (
    <section
      aria-label={t("label")}
      className={inline ? "mx-auto w-full" : "mx-auto max-w-5xl px-6"}
    >
      <ul
        className={
          inline
            ? "flex flex-wrap items-center justify-center gap-x-5 gap-y-3"
            : "flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-fd-border py-5"
        }
      >
        {STATUS_BADGES.map((badge) => (
          <li key={badge.key} className="inline-flex">
            <a
              href={badge.href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex rounded transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
            >
              {/* A fixed 20px height slot reserves vertical space so the band does not shift as badges load. */}
              {/* biome-ignore lint/performance/noImgElement: external SVG badge endpoints are not optimizable by next/image. */}
              <img
                src={badge.src}
                alt={t(badge.altKey)}
                height={20}
                className="block h-5 w-auto"
                loading="lazy"
                decoding="async"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
