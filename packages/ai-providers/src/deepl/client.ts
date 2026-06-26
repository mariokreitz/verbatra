import * as deepl from "deepl-node";
import { requireDeepLKey } from "../env.js";
import { silenceSdkLogging } from "./log-suppression.js";
import type { DeepLClientBundle, DeepLTextResult, DeepLTranslateClient } from "./types.js";

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
