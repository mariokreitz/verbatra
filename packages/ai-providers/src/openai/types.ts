import type { OpenAiRequest } from "./request.js";

/** An assistant message, narrowed to the fields this provider reads. */
export interface OpenAiMessage {
  readonly content?: string | null;
  readonly refusal?: string | null;
}

/** A single completion choice, narrowed to the fields this provider reads. */
export interface OpenAiChoice {
  readonly message: OpenAiMessage;
  readonly finish_reason?: string | null;
}

/** A Chat Completions response, narrowed to the fields this provider reads. */
export interface OpenAiCompletion {
  readonly choices: readonly OpenAiChoice[];
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

/** Per-call options this provider forwards to the SDK; currently only cancellation. */
export interface OpenAiCallOptions {
  readonly signal?: AbortSignal;
}

/**
 * The minimal client surface this provider depends on. Tests inject a stub so the
 * network is never touched; production wraps the real openai SDK client.
 */
export interface OpenAiClient {
  chat: {
    completions: {
      create(body: OpenAiRequest, options?: OpenAiCallOptions): Promise<OpenAiCompletion>;
    };
  };
}
