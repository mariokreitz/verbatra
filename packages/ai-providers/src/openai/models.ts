import type OpenAI from "openai";

/**
 * The OpenAI authoring model type, sourced from the OpenAI SDK's published chat-model union
 * so verbatra restates no model IDs. Type-only: it drives editor completions and is never
 * read at runtime, where the schema stays `z.string().min(1)`.
 */
export type OpenAiModel = OpenAI.ChatModel;
