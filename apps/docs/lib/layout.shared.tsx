import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// Shared chrome for both the home and docs layouts: the verbatra wordmark in the
// nav and a link to the repository. The wordmark uses the display face; the real
// "V" mark + SVG wordmark lands in the dedicated logo/favicon step.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span
          className="text-base font-semibold tracking-widest"
          style={{ fontFamily: "var(--font-display)" }}
        >
          VERBATRA
        </span>
      ),
    },
    githubUrl: "https://github.com/mariokreitz/verbatra",
  };
}
