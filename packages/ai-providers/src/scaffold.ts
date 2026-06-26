/**
 * A cosmetic default model per LLM provider for the `init` scaffold. These are real
 * model IDs so a freshly scaffolded config type-checks immediately under the
 * per-provider model schema; they may go stale as provider SDKs add models, which is
 * cosmetic (the runtime accepts any non-empty model string). DeepL is omitted: it is
 * an MT API with no model.
 */
export const SCAFFOLD_MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.4-mini",
  gemini: "gemini-2.5-flash",
} as const;
