import { beforeEach, onTestFailed } from "vitest";
import { collectFailureReport, redactSecrets, resetRecordedRuns } from "./diagnostics.js";

/**
 * Vitest setup file: prints the captured stdout and stderr of every CLI run a test started, but
 * only when that test fails.
 *
 * Without this, a failing e2e test shows nothing but the assertion diff (or "pollUntil timed out"),
 * while the CLI's own structured `verbatra: error [CODE] message` line sits unread in the harness
 * result. Registering the hook in `beforeEach` covers every test in the suite without touching a
 * single test file, and covers both failure shapes: an assertion on a completed run, and a throw
 * while a spawned process is still running.
 *
 * The hook never throws and never waits indefinitely: a diagnostic that hangs or fails is worse
 * than no diagnostic at all on a test that is already red.
 */
beforeEach(() => {
  resetRecordedRuns();
  onTestFailed(async () => {
    try {
      for (const block of await collectFailureReport()) {
        console.error(block);
      }
    } catch (error) {
      console.error(
        `e2e failure diagnostics could not be produced: ${redactSecrets(String(error))}`,
      );
    }
  });
});
