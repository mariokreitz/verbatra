import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// Shared chrome for both the home and docs layouts: the V mark and verbatra wordmark in
// the nav, a Docs link, and a link to the repository. The wordmark uses the display face.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{
              filter: "drop-shadow(0 0 4px color-mix(in srgb, var(--v-glow) 60%, transparent))",
            }}
          >
            <path
              d="M4 4 L12 20 L20 4"
              stroke="var(--v-glow)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="text-base font-semibold tracking-widest"
            style={{ fontFamily: "var(--font-display)" }}
          >
            VERBATRA
          </span>
        </span>
      ),
    },
    links: [{ text: "Docs", url: "/docs" }],
    githubUrl: "https://github.com/mariokreitz/verbatra",
  };
}
