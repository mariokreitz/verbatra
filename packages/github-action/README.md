# verbatra GitHub Action

A composite GitHub Action that runs the verbatra CLI in CI, annotates failures, and writes a
job summary. It runs `verbatra translate --json`, turns the result into GitHub annotations and a
job-summary table, and propagates the CLI exit code so the job fails when translation fails.

This action is consumed via `uses:`; it is not published to npm. At run time it installs the
`@verbatra/cli` at the pinned `version` via `npx` and runs it.

## Usage

```yaml
name: Translate
on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - uses: mariokreitz/verbatra/packages/github-action@<commit-sha> # v1.1.0
        with:
          version: 1.2.3
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

A composite action cannot declare its own `permissions:`; only the consuming workflow can. Set
`permissions:` to least privilege at the workflow or job level. The documented happy path needs
only `contents: read`. Do not grant anything broader unless your own surrounding steps require it.

Pin every `uses:` reference, including this action itself, to a full commit SHA rather than a
mutable tag such as `@v1.1.0` or `@v4`, matching this repository's own SHA-pinning convention
(see `actions/checkout` above). `<commit-sha>` above is a placeholder: replace it with the full
40-character SHA of the release commit of this action you intend to depend on, and keep the
version tag as a trailing comment so the pin stays readable.

## Secret wiring

Provider API keys are passed via `env:` from `secrets.*`, for example
`ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`. Keys come only from the environment. A key
value is never inlined into YAML and is never passed as an action input. The action and the CLI
read keys only from the environment, so a `${{ secrets.* }}` reference in `env:` is the single
supported way to provide them.

The four recognized environment variable names are:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `DEEPL_API_KEY`

Set only the keys your configured provider needs. Each value must be a `${{ secrets.* }}`
reference, never a literal:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
```

## Version pinning

The `version` input MUST be pinned to an exact version (for example `version: 1.2.3`) for
reproducible, supply-chain-safe CI. Do not use a floating tag such as `latest` and do not use a
range. A floating tag pulls whatever is newest at run time, which is non-reproducible and would
auto-pull a compromised release.

The action installs the CLI via `npx` at run time, so the pinned `version` is what governs
reproducibility: pinning it pins exactly which CLI release runs.

## Job summary and annotations

The action writes a job summary to `GITHUB_STEP_SUMMARY` (a per-locale counts table, or a
whole-run failure heading) and annotates failures via `::error::` workflow commands. On a
per-locale failure it emits one annotation per failed locale; on a whole-run failure it emits one
annotation built from the CLI error. The job then exits with the CLI exit code.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `version` | yes | none | The `@verbatra/cli` version to run, for example `1.2.3`. Pin to an exact version; do not use a floating tag such as `latest`. |
| `config-path` | no | `""` | Explicit config file to load (maps to `--config`). Empty uses the normal config search. |
| `working-directory` | no | `""` | Directory to resolve config and locale files against (maps to `--cwd`). |
| `dry-run` | no | `"false"` | Report what would change without calling a provider or writing (maps to `--dry-run`). |
| `node-version` | no | `"24"` | Node.js version to set up for running the CLI. |
