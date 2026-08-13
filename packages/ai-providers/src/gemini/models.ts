import type { Interactions } from "@google/genai";

/**
 * The Gemini authoring model type, sourced from the installed SDK's own model union so
 * verbatra restates no model IDs. It is an open union, so unknown model IDs are still
 * accepted. Type-only: it informs editor completions and is never validated at runtime,
 * where the schema stays `z.string().min(1)`.
 */
export type GeminiModel = Interactions.Model;
