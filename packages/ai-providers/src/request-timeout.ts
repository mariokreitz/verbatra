import { ProviderError } from "./errors.js";
import { guardProviderCall } from "./guard.js";

/**
 * The verbatra-imposed per-request timeout applied to every provider's outbound request when the
 * provider config does not set its own `requestTimeoutMs`. Two minutes: long enough that a
 * legitimately slow large batch (a big sub-batch on a hosted or local model) is not cut off, short
 * enough that a hung-but-alive server (a stuck local OpenAI-compatible endpoint that accepts the
 * connection but never responds) cannot hold a locale's write lock open indefinitely. Every provider
 * relies on this bound rather than the vendor SDK's own default, which a hung-but-alive server never
 * triggers.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Build the static, secret-free message for a verbatra-imposed request timeout. It names only the
 * elapsed bound in milliseconds (a plain number), never a key, URL, header, or the raw SDK error.
 *
 * @param timeoutMs - The elapsed millisecond bound to name in the message.
 * @returns The fixed, safe timeout message.
 */
export function requestTimedOutMessage(timeoutMs: number): string {
  return `The translation provider request exceeded the ${timeoutMs} ms request timeout.`;
}

/** Compose the caller's cancellation signal, if any, with the timeout's own signal. */
function combineSignals(caller: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  return caller === undefined ? timeout : AbortSignal.any([caller, timeout]);
}

/**
 * Bound one outbound provider request with a verbatra-imposed, abortable timeout, so no single
 * provider call can hang unbounded and hold a caller's lock open forever. A per-request
 * `AbortController` is created and composed with the caller's own signal (via {@link combineSignals});
 * the composed signal is passed to `call`, so a signal-aware vendor SDK is really cancelled when the
 * timeout fires, and to {@link guardProviderCall}, so a raw SDK error still becomes a secret-free
 * {@link ProviderError} and a genuine caller abort is still re-thrown unwrapped.
 *
 * The guarded call is raced against the timer rather than merely handed the composed signal, so a
 * client that cannot honor a signal (deepl-node) is still bounded: its await loses the race and the
 * call rejects on timeout, releasing the caller's lock, even though the in-flight request itself
 * cannot be interrupted. When the timer wins, the controller is aborted and a secret-free
 * {@link ProviderError} with the retriable `TIMEOUT` code is thrown; the raced-away call's own later
 * rejection is discarded, never referenced or logged, so a raw SDK error can never leak through it.
 *
 * @param timeoutMs - The positive millisecond bound for this request; resolved from provider config.
 * @param callerSignal - The caller's cancellation signal, if any, composed with the timeout's.
 * @param call - A thunk performing exactly the raw SDK call, given the composed signal to thread on.
 * @returns The call's resolved value, unchanged, when it settles before the timeout.
 * @throws {@link ProviderError} `TIMEOUT` (retriable, secret-free) when `timeoutMs` elapses first.
 * @throws Whatever {@link guardProviderCall} throws otherwise: a secret-free {@link ProviderError}
 *   for a classified SDK failure, or the raw abort-shaped error for a genuine caller abort.
 */
export async function withRequestTimeout<T>(
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
  call: (signal: AbortSignal) => Promise<T>,
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
    return await Promise.race([guardProviderCall(() => call(signal), signal), timedOut]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
