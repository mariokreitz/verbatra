import { beforeEach, onTestFailed } from "vitest";
import { collectFailureReport, redactSecrets, resetRecordedRuns } from "./diagnostics.js";

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
