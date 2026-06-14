import type { TranslationEntry } from "@verbatra/core";
import type { BuiltRequest } from "./anthropic/request.js";
import type { AnthropicMessage, MessagesClient } from "./anthropic/types.js";
import type { OpenAiRequest } from "./openai/request.js";
import type { OpenAiClient, OpenAiCompletion, OpenAiMessage } from "./openai/types.js";
import type { PlaceholderExtractor } from "./provider.js";

/** Build a translation entry for tests. */
export function entry(
  key: string,
  value: string,
  placeholders: readonly string[] = [],
  extra: { description?: string; meaning?: string } = {},
): TranslationEntry {
  return { key, namespace: "messages", value, placeholders, isPlural: false, ...extra };
}

/** A simple offline extractor matching {{x}} and {x} tokens. Linear (ReDoS-safe). */
export const regexExtractor: PlaceholderExtractor = (value) =>
  value.match(/\{\{[^{}]+\}\}|\{[^{}]+\}/g) ?? [];

/** Build a tool-use response message as the Anthropic API would return it. */
export function toolMessage(
  translations: ReadonlyArray<{ key: string; value: string }>,
  usage?: { input_tokens?: number; output_tokens?: number },
): AnthropicMessage {
  const content = [
    { type: "tool_use", id: "tool-1", name: "submit_translations", input: { translations } },
  ];
  return usage === undefined ? { content } : { content, usage };
}

/** An offline stub client that records every request body it receives. */
export function stubClient(message: AnthropicMessage): {
  client: MessagesClient;
  calls: BuiltRequest[];
} {
  const calls: BuiltRequest[] = [];
  const client: MessagesClient = {
    messages: {
      create: async (body) => {
        calls.push(body);
        return message;
      },
    },
  };
  return { client, calls };
}

/** Return the first recorded request body, or throw if the client was not called. */
export function firstCall(calls: readonly BuiltRequest[]): BuiltRequest {
  const body = calls[0];
  if (body === undefined) {
    throw new Error("expected the client to have been called at least once");
  }
  return body;
}

/** Build a Chat Completions response as the openai SDK would return it. */
export function openAiCompletion(
  message: OpenAiMessage,
  usage?: { prompt_tokens?: number; completion_tokens?: number },
): OpenAiCompletion {
  const choices = [{ message }];
  return usage === undefined ? { choices } : { choices, usage };
}

/** A schema-conforming OpenAI completion carrying the given per-key translations. */
export function openAiResult(
  translations: ReadonlyArray<{ key: string; value: string }>,
  usage?: { prompt_tokens?: number; completion_tokens?: number },
): OpenAiCompletion {
  return openAiCompletion({ content: JSON.stringify({ translations }) }, usage);
}

/** An offline OpenAI stub client that records every request body it receives. */
export function openAiStubClient(completion: OpenAiCompletion): {
  client: OpenAiClient;
  calls: OpenAiRequest[];
} {
  const calls: OpenAiRequest[] = [];
  const client: OpenAiClient = {
    chat: {
      completions: {
        create: async (body) => {
          calls.push(body);
          return completion;
        },
      },
    },
  };
  return { client, calls };
}

/** Return the first recorded OpenAI request body, or throw if the client was not called. */
export function firstOpenAiCall(calls: readonly OpenAiRequest[]): OpenAiRequest {
  const body = calls[0];
  if (body === undefined) {
    throw new Error("expected the client to have been called at least once");
  }
  return body;
}
