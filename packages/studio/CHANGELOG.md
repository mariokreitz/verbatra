# @verbatra/studio

## 0.1.0-next.2

### Patch Changes

- 4accc85: Republish through the automated release pipeline so the package carries an npm provenance attestation, matching `@verbatra/sdk` and `@verbatra/cli`. The initial release was published manually to bootstrap npm's Trusted Publishing for a brand-new package, which cannot generate provenance outside a CI environment; no functional change.

## 0.1.0-next.1

### Minor Changes

- bc0be98: Publish `@verbatra/studio` to npm as an optional companion package to `@verbatra/cli`. It can now be installed directly (`npm install @verbatra/studio`) or added alongside the CLI so the `verbatra studio` command has the dashboard available. This is a packaging change only; the dashboard itself works the same as before.

## 0.0.1-next.0

### Patch Changes

- Updated dependencies [5597f98]
- Updated dependencies [4a789ff]
  - @verbatra/sdk@0.5.0-next.0
