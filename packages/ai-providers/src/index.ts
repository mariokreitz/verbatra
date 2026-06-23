/**
 * Translation providers behind a single {@link TranslationProvider} contract and a
 * {@link ProviderRegistry}. v1 ships four: three LLM providers (Anthropic, OpenAI, Gemini) built on the
 * shared LLM layer via the {@link LlmMechanism} extension point and {@link runLlmTranslation}, and DeepL,
 * a machine-translation provider that implements the contract directly. The LLM layer constrains and
 * validates every model against one single-source schema ({@link translationsResultSchema}) so the
 * constraint and the validation cannot drift. Failures surface as secret-free {@link ProviderError}s,
 * by construction, not by scrubbing: an underlying SDK throw is mapped to a static error and raw SDK text
 * is never bound. {@link redact} is a separate standalone utility. API keys are read only from the
 * environment; translatable strings are treated as untrusted and travel only in the data channel.
 *
 * @packageDocumentation
 */

export {
  type AnthropicDeps,
  createAnthropicProvider,
} from "./anthropic/anthropic-provider.js";
export {
  type AnthropicConfig,
  anthropicConfigSchema,
} from "./anthropic/config.js";
export {
  type DeepLConfig,
  deepLConfigSchema,
} from "./deepl/config.js";
export {
  createDeepLProvider,
  type DeepLDeps,
} from "./deepl/deepl-provider.js";
export type {
  DeepLTranslateResult,
  ProviderNotice,
  ProviderNoticeCode,
} from "./deepl/types.js";
export { ProviderError, type ProviderErrorCode } from "./errors.js";
export {
  type GeminiConfig,
  geminiConfigSchema,
} from "./gemini/config.js";
export {
  createGeminiProvider,
  type GeminiDeps,
} from "./gemini/gemini-provider.js";
export {
  type OpenAiConfig,
  openAiConfigSchema,
} from "./openai/config.js";
export {
  createOpenAiProvider,
  type OpenAiDeps,
} from "./openai/openai-provider.js";
export type {
  PlaceholderExtractor,
  ProviderKind,
  Tone,
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
  Usage,
} from "./provider.js";
// Redaction utility (a standalone scrubber for an explicit log/error sink; NOT the provider error path,
// which is secret-free by construction)
export { redact } from "./redaction.js";
export { ProviderRegistry, type ProviderResolution } from "./registry.js";
