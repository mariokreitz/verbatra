# @verbatra/studio

## 0.1.0-next.5

### Patch Changes

- Updated dependencies [35fe0f6]
- Updated dependencies [874cf70]
- Updated dependencies [e617c6b]
- Updated dependencies [dfd2b77]
  - @verbatra/sdk@0.5.0-next.3

## 0.1.0-next.4

### Patch Changes

- Updated dependencies [565eb89]
- Updated dependencies [4c6fd52]
- Updated dependencies [2127234]
- Updated dependencies [f3fd15f]
  - @verbatra/sdk@0.5.0-next.2

## 0.1.0-next.3

### Patch Changes

- 7e486ed: Add `OPENAI_COMPATIBLE_API_KEY` to the exact-value redaction scrub list, alongside the four hosted providers' key environment variables, so a real key set for the `openai-compatible` provider is redacted from projected config strings and mapped error messages the same way the hosted providers' keys already are.
- Updated dependencies [14e9719]
- Updated dependencies [440212e]
- Updated dependencies [54a641a]
- Updated dependencies [400e044]
- Updated dependencies [2fe16b2]
- Updated dependencies [b945e53]
  - @verbatra/sdk@0.5.0-next.1

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
