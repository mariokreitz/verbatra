import type { Interactions } from "@google/genai";

/**
 * The Gemini authoring model type, sourced from the installed Google GenAI SDK's own
 * published model union. verbatra restates no model IDs of its own: when the installed
 * SDK adds a model literal, this completion set follows with no edit here. The SDK type
 * is already an open union (its known literals plus `string & {}`), so an unknown or
 * newly released model ID is still accepted. This informs editor completions and the
 * authoring type only; it is never read in a runtime branch and never validated against.
 * The runtime schema stays `z.string().min(1)`.
 *
 * The import is type-only, so it adds no runtime dependency edge.
 */
export type GeminiModel = Interactions.Model;
