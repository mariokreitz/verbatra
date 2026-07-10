/**
 * Translation providers behind a single {@link TranslationProvider} contract and a
 * {@link ProviderRegistry}. Four LLM providers (Anthropic, OpenAI, Gemini, and openai-compatible, for a
 * local or self-hosted OpenAI-compatible server) are built on the shared {@link runLlmTranslation} layer,
 * and DeepL, a machine-translation provider, implements the contract directly. Failures surface as
 * secret-free {@link ProviderError}s by construction (an SDK throw is mapped to a static error, raw SDK
 * text is never bound); {@link redact} is a defense-in-depth backstop in the constructor. API keys are
 * read only from the environment (openai-compatible's key resolution additionally falls back to a
 * non-secret placeholder when none is configured); translatable strings are untrusted and travel only in
 * the data channel.
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
export type { AnthropicModel } from "./anthropic/models.js";
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
export { PROVIDER_ENV } from "./env.js";
export { ProviderError, type ProviderErrorCode } from "./errors.js";
export {
  type GeminiConfig,
  geminiConfigSchema,
} from "./gemini/config.js";
export {
  createGeminiProvider,
  type GeminiDeps,
} from "./gemini/gemini-provider.js";
export type { GeminiModel } from "./gemini/models.js";
export {
  type OpenAiConfig,
  openAiConfigSchema,
} from "./openai/config.js";
export type { OpenAiModel } from "./openai/models.js";
export {
  createOpenAiProvider,
  type OpenAiDeps,
} from "./openai/openai-provider.js";
export {
  type OpenAiCompatibleConfig,
  openAiCompatibleConfigSchema,
} from "./openai-compatible/config.js";
export {
  createOpenAiCompatibleProvider,
  type OpenAiCompatibleDeps,
} from "./openai-compatible/openai-compatible-provider.js";
export type {
  PlaceholderExtractor,
  ProviderKind,
  Tone,
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
  Usage,
} from "./provider.js";
export { redact } from "./redaction.js";
export { ProviderRegistry, type ProviderResolution } from "./registry.js";
export { SCAFFOLD_MODELS } from "./scaffold.js";
