import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// Shared chrome for both the home and docs layouts: the verbatra wordmark in the nav
// and a link to the repository.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "verbatra",
    },
    githubUrl: "https://github.com/mariokreitz/verbatra",
  };
}
