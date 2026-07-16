"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Spotlight } from "./spotlight";

const GridBeams = dynamic(() => import("./grid-beams").then((m) => m.GridBeams), { ssr: false });
const Sparkles = dynamic(() => import("./sparkles").then((m) => m.Sparkles), { ssr: false });

/**
 * The layered decorative background shared by the hero and the final CTA.
 * The grid/beams and the sparkle canvas render nothing meaningful on the
 * server, so they load with ssr:false; the CSS-only spotlight stays
 * server-rendered. This wrapper owns the dynamic, client-only imports.
 */
export function Backdrop({
  gridFade,
  beams = true,
  spotlightFill,
  sparkleDensity,
}: {
  gridFade?: string;
  beams?: boolean;
  spotlightFill?: string;
  sparkleDensity?: number;
}): ReactNode {
  return (
    <>
      <GridBeams fade={gridFade} beams={beams} />
      <Spotlight fill={spotlightFill} />
      <Sparkles density={sparkleDensity} />
    </>
  );
}
