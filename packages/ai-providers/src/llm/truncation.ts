import { ProviderError } from "../errors.js";

export const OUTPUT_TRUNCATED_MESSAGE =
  "The provider stopped because the output-token limit was reached. " +
  "Reduce the batch size or raise the configured max output tokens.";

export function assertNotTruncated(truncated: boolean): void {
  if (truncated) {
    throw new ProviderError("OUTPUT_TRUNCATED", OUTPUT_TRUNCATED_MESSAGE);
  }
}
