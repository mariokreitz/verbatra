import type OpenAI from "openai";

/**
 * The OpenAI authoring model type, sourced from the OpenAI SDK's published chat-model
 * union. It drives editor completions only; it is never read at runtime, and the
 * runtime schema stays `z.string().min(1)`.
 */
export type OpenAiModel = OpenAI.ChatModel;
