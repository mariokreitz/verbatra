import type { TranslationEntry } from "@verbatra/core";
import type { BuiltRequest } from "./anthropic/request.js";
import type { AnthropicMessage, MessagesClient } from "./anthropic/types.js";
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
