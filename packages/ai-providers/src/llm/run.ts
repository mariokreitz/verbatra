import { checkBatchIntegrity } from "../integrity.js";
import {
  type TranslateRequest,
  type TranslateResult,
  type Usage,
  validateRequest,
} from "../provider.js";
import { toIntegrityInputs } from "./integrity-inputs.js";
import { buildDataPayload } from "./payload.js";
import { reconcileResult } from "./response.js";

/** Schema-bound output plus optional usage returned by a provider mechanism. */
export interface LlmCompletion {
  readonly raw: unknown;
  readonly usage?: Usage;
}

/** Input handed to a mechanism: the structured data channel and the requested keys. */
export interface LlmCompletionInput {
  readonly payloadJson: string;
  readonly requestedKeys: readonly string[];
}

/**
 * The single provider-supplied extension point. Given the shared data payload, a
 * mechanism builds its SDK request, calls it, and returns schema-bound per-key
 * translations as raw data (validated by the shared layer), never free text. It
 * surfaces refusals and SDK errors as secret-free ProviderErrors.
 */
export interface LlmMechanism {
  translate(input: LlmCompletionInput): Promise<LlmCompletion>;
}

/**
 * The provider-agnostic LLM flow every LLM provider runs. It validates the request
 * (the mandatory-extractor gate fires here, before any mechanism call), builds the
 * structured data channel, delegates schema-bound output to the mechanism, then
 * validates, maps, and integrity-checks on our side.
 */
export async function runLlmTranslation(
  request: TranslateRequest,
  mechanism: LlmMechanism,
): Promise<TranslateResult> {
  const data = validateRequest(request);
  const payloadJson = JSON.stringify(buildDataPayload(data));
  const requestedKeys = data.entries.map((entry) => entry.key);
  const completion = await mechanism.translate({ payloadJson, requestedKeys });
  const values = reconcileResult(completion.raw, requestedKeys);
  const integrity = checkBatchIntegrity(
    toIntegrityInputs(data.entries, values),
    request.extractPlaceholders,
  );
  return completion.usage === undefined
    ? { values, integrity }
    : { values, integrity, usage: completion.usage };
}
