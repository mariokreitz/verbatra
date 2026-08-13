import type { GeminiRequest } from "./request.js";

export interface GeminiCandidate {
  readonly finishReason?: string;
}

export interface GeminiResponse {
  readonly text?: string;
  readonly candidates?: readonly GeminiCandidate[];
  readonly promptFeedback?: { readonly blockReason?: string };
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
  };
}

export interface GeminiClient {
  models: { generateContent(request: GeminiRequest): Promise<GeminiResponse> };
}
