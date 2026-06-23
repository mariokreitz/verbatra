import type OpenAI from "openai";

/**
 * The OpenAI authoring model type, sourced from the installed OpenAI SDK's own published
 * chat-model union. verbatra restates no model IDs of its own: when the installed SDK
 * adds a model literal, this completion set follows with no edit here. The SDK union is
 * closed; the authoring layer in the SDK package widens it to an open union so an unknown
 * or newly released model ID is still suggested without being required. This informs
 * editor completions and the authoring type only; it is never read in a runtime branch
 * and never validated against. The runtime schema stays `z.string().min(1)`.
 *
 * The import is type-only, so it adds no runtime dependency edge.
 */
export type OpenAiModel = OpenAI.ChatModel;
