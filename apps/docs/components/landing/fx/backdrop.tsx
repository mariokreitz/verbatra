"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Spotlight } from "./spotlight";

// The layered decorative background shared by the hero and the final CTA. The grid/beams
// and the sparkle canvas render nothing meaningful on the server, so they are loaded with
// ssr:false (Vercel 2.4) and mount on the client. The spotlight is plain CSS markup and
// stays server-rendered through this client boundary. This wrapper is the single place
// that owns the dynamic, client-only imports.
const GridBeams = dynamic(() => import("./grid-beams").then((m) => m.GridBeams), { ssr: false });
const Sparkles = dynamic(() => import("./sparkles").then((m) => m.Sparkles), { ssr: false });

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
