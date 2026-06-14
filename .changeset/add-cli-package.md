---
"@verbatra/cli": minor
---

Add @verbatra/cli, the v1 command-line interface and a thin wrapper over @verbatra/sdk. It exposes a
`verbatra` binary with two subcommands: `translate` (one-shot) and `watch` (long-running). The CLI
parses arguments with commander, loads config via the SDK's loadConfig, calls the SDK's translate()
or watch(), and renders the returned structured result — adding no translation, diff, or lock logic
of its own. Shared `--cwd` and `--config` (a pass-through to loadConfig's configPath); `translate`
adds `--dry-run` and `--json`; `watch` adds `--debounce` and `--json` (NDJSON, one record per run).
Human output by default, with strict stdout/stderr discipline so `--json` stdout is a clean,
parseable stream. Exit codes: 0 success, 1 a per-locale failure, 2 a whole-run/startup/usage error,
130 a forced second Ctrl-C during watch. SIGINT triggers a graceful stop that awaits the in-flight
run. The only new dependency is commander (pinned exact).
