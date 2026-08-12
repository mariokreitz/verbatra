export const GITHUB_URL = "https://github.com/mariokreitz/verbatra";
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;
/**
 * GitHub Releases, the project's changelog surface.
 *
 * The release workflow creates these entries with `createGithubReleases: true` in the same
 * Changesets step that runs `changeset publish`, so a release page exists exactly when the
 * version exists on npm. That is why this is linked instead of the per-package CHANGELOG.md
 * files on `main`, which gain a version when the Version Packages PR merges, before the
 * publish. Readers therefore never see a version they cannot install.
 */
export const RELEASES_URL = `${GITHUB_URL}/releases`;
export const NPM_CLI = "https://www.npmjs.com/package/@verbatra/cli";
export const NPM_SDK = "https://www.npmjs.com/package/@verbatra/sdk";
export const NPM_STUDIO = "https://www.npmjs.com/package/@verbatra/studio";
export const CONTRIBUTING_URL = `${GITHUB_URL}/blob/main/CONTRIBUTING.md`;
export const CODE_OF_CONDUCT_URL = `${GITHUB_URL}/blob/main/CODE_OF_CONDUCT.md`;
export const SECURITY_URL = `${GITHUB_URL}/blob/main/SECURITY.md`;
