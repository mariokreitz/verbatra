import { ProviderError } from "./errors.js";
import { guardProviderCall, type ProviderCallContext } from "./guard.js";

export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

export function requestTimedOutMessage(timeoutMs: number): string {
  return `The translation provider request exceeded the ${timeoutMs} ms request timeout.`;
}

function combineSignals(caller: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  return caller === undefined ? timeout : AbortSignal.any([caller, timeout]);
}

export async function withRequestTimeout<T>(
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
  call: (signal: AbortSignal) => Promise<T>,
  context?: ProviderCallContext,
): Promise<T> {
  const timeoutController = new AbortController();
  const signal = combineSignals(callerSignal, timeoutController.signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timeoutController.abort();
      reject(new ProviderError("TIMEOUT", requestTimedOutMessage(timeoutMs)));
    }, timeoutMs);
  });
  try {
    return await Promise.race([guardProviderCall(() => call(signal), signal, context), timedOut]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
