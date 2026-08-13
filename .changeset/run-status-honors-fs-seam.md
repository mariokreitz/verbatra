---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix run status writing to go through the injected `SdkFs` instead of calling `node:fs/promises`
`mkdir` directly. Before this fix, a run that recorded run status created the `.verbatra-local`
directory on the real file system even when a custom `deps.fs` was supplied; that directory
creation now goes through the seam. The `SdkFs` interface is unchanged: the existing optional
`mkdir` member already carried this capability, so the published declarations are identical.

A custom `deps.fs` whose `writeFile` targets a real directory tree must now implement the optional
`mkdir` member for the run status file to be written, since the SDK no longer creates that directory
behind the seam. Run status writing is best-effort, so a fs without it degrades to no run status
file rather than failing the run.
