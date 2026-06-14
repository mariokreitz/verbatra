# Hardening backlog

Tracked, non-blocking hardening items deferred from a completed review chain. Each was
assessed as low-risk and fail-safe; recorded here so it is not lost.

## atomic-write reconciliation (SDK + adapter)

These three share fixes across the SDK and adapter atomic writes; consider reconciling the two
deliberately-mirrored implementations into one shared, fully-hardened atomic-write helper when
this pass is done, rather than applying each fix twice. (A flag that the mirror is accumulating
shared concerns, not a decision to extract now.)

### SDK lock-file write cleanup is not best-effort

`packages/sdk/src/fs.ts` `atomicWrite` uses an unwrapped `await rm(...)`, so a cleanup failure
could shadow the original fs error, and it only cleans on a rename failure (not a temp-write
failure). The adapter's atomic write is now stricter (best-effort cleanup wrapped in its own
try/catch that swallows its error, cleaning on both the temp-write and rename failure paths).
Fix: align the SDK to the adapter's discipline.

### Atomic write does not preserve target file mode (both adapter and SDK)

The prior in-place `writeFile` preserved an existing file's permission bits; the atomic
temp+rename replaces the inode with a default-mode (typically 644) file, so a user-tightened
mode (for example `chmod 600`) is reset on the next write. This is a benign-but-real behavior
change (locale and lock files are non-secret), NOT pure hardening. Fix: before rename, stat the
existing target (when present) and chmod the temp to match (and ideally chown). Applies to both
the adapter write and the SDK lock-file write.

### Predictable temp name + symlink-following write (both adapter and SDK)

The temp name is `pid+timestamp` (predictable) and node's default `"w"` flag follows symlinks
and truncates, so a pre-planted symlink at the temp path could redirect the write. Low-risk
under the local, single-run, trusted-project model (matches the rest of the tool) — defense in
depth only. Fix: exclusive create (`"wx"` / `O_CREAT|O_EXCL`) so a pre-existing temp path fails
rather than being followed, plus a randomized temp suffix. Applies to both writes.
