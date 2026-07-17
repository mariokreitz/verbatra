---
"@verbatra/studio": minor
"@verbatra/cli": minor
---

Add an opt-in WebMCP agent-tools surface to Studio, off by default.

When enabled, the prebuilt dashboard registers its existing RPC methods as WebMCP tools on a
supporting browser's `document.modelContext`, so an agent on the open, authenticated tab can drive
the same read, edit, and (with `--allow-spend`) provider actions the dashboard already exposes.
Each tool is a 1:1 wrapper over the same authenticated server call, validation, and capability gate;
registration grants no authority the tab did not already hold. Enable it with the new
`verbatra studio --expose-agent-tools` flag or the `VERBATRA_STUDIO_AGENT_TOOLS` environment
variable; both default to off. The two spend tools require both flags: `--expose-agent-tools` to
expose the surface and `--allow-spend` to enable them.
