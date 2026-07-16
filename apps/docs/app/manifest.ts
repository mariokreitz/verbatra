import type { MetadataRoute } from "next";

/** The web app manifest served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "verbatra",
    short_name: "verbatra",
    description: "Incremental i18n translation automation for developers.",
    start_url: "/",
    display: "standalone",
    theme_color: "#0B0B12",
    background_color: "#0B0B12",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
