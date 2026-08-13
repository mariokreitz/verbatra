import { getErrorStatus } from "../error-classification.js";

export interface GeminiRetryConfig {
  readonly attempts: number;
  readonly baseDelayMs: number;
}

export const DEFAULT_GEMINI_RETRY: GeminiRetryConfig = { attempts: 3, baseDelayMs: 250 };

function isRetryableStatus(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 429 || (status !== undefined && status >= 500 && status < 600);
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function throwAbort(signal: AbortSignal | undefined): never {
  signal?.throwIfAborted();
  throw new DOMException("This operation was aborted.", "AbortError");
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withGeminiRetry<T>(
  call: () => Promise<T>,
  signal?: AbortSignal,
  config: GeminiRetryConfig = DEFAULT_GEMINI_RETRY,
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await call();
    } catch (error) {
      if (isAborted(signal)) {
        throwAbort(signal);
      }
      const exhausted = attempt >= config.attempts;
      if (exhausted || !isRetryableStatus(error)) {
        throw error;
      }
      await delay(config.baseDelayMs * 2 ** (attempt - 1), signal);
      if (isAborted(signal)) {
        throwAbort(signal);
      }
      attempt += 1;
    }
  }
}
