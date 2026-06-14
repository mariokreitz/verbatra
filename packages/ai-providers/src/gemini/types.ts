import type { GeminiRequest } from "./request.js";

/** A response candidate, narrowed to the field this provider reads. */
export interface GeminiCandidate {
  readonly finishReason?: string;
}

/** A generateContent response, narrowed to the fields this provider reads. */
export interface GeminiResponse {
  readonly text?: string;
  readonly candidates?: readonly GeminiCandidate[];
  readonly promptFeedback?: { readonly blockReason?: string };
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
  };
}

/**
 * The minimal client surface this provider depends on. Tests inject a stub so the
 * network is never touched; production wraps the real @google/genai client.
 */
export interface GeminiClient {
  models: { generateContent(request: GeminiRequest): Promise<GeminiResponse> };
}
