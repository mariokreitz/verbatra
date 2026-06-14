import * as deepl from "deepl-node";
import log from "loglevel";
import { requireDeepLKey } from "../env.js";
import type { DeepLClientBundle, DeepLTextResult, DeepLTranslateClient } from "./types.js";

/**
 * Silence the deepl-node SDK's own request logging. deepl-node logs the request body
 * (translatable content) at debug via a shared loglevel logger named "deepl"; it is off
 * by default (warn), but the surrounding application could raise the global loglevel for
 * its own reasons and start logging user content. Pinning the SDK's logger to silent
 * defends against that regardless of host-app config. (The auth header is never passed to
 * any log call, so the key itself cannot leak via logging.)
 *
 * IMPORTANT: this works only because our `loglevel` dependency resolves to the SAME
 * version deepl-node uses, so pnpm dedupes to one logger-singleton instance. The
 * `loglevel` version MUST track deepl-node's resolved loglevel; if deepl-node bumps it and
 * the dedupe splits into two instances, this setLevel would no longer silence the SDK's
 * logger and content logging would silently resume. A test asserts the "deepl" logger is
 * actually silenced, so a future split fails a test instead of quietly leaking content.
 */
export function silenceSdkLogging(): void {
  log.getLogger("deepl").setLevel("silent");
}

/**
 * Build the production client by wrapping the real deepl-node Translator. The key is read
 * here and the free-account flag is derived from it (ends in ":fx") WITHOUT logging it, so
 * the mechanism never sees the key. The SDK type coupling and the only key read are
 * confined to this one adapter.
 */
export function createDefaultClient(): DeepLClientBundle {
  silenceSdkLogging();
  const authKey = requireDeepLKey();
  const freeAccount = authKey.endsWith(":fx");
  const translator = new deepl.Translator(authKey);
  const client: DeepLTranslateClient = {
    translateText: async (texts, sourceLang, targetLang, options): Promise<DeepLTextResult[]> =>
      (await translator.translateText(
        texts as string[],
        sourceLang as deepl.SourceLanguageCode | null,
        targetLang as deepl.TargetLanguageCode,
        options as deepl.TranslateTextOptions,
      )) as unknown as DeepLTextResult[],
  };
  return { client, freeAccount };
}
