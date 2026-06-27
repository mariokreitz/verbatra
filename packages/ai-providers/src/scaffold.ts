/**
 * A default model per LLM provider for the `init` scaffold. These are real model IDs so a freshly
 * scaffolded config type-checks immediately; staleness is cosmetic since the runtime accepts any
 * non-empty model string. DeepL is omitted as an MT API with no model.
 */
export const SCAFFOLD_MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.4-mini",
  gemini: "gemini-2.5-flash",
} as const;
