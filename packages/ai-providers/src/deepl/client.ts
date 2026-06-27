import * as deepl from "deepl-node";
import { requireDeepLKey } from "../env.js";
import { silenceSdkLogging } from "./log-suppression.js";
import type { DeepLClientBundle, DeepLTextResult, DeepLTranslateClient } from "./types.js";

/**
 * Build the production DeepL client. Reads the key from the environment and derives the
 * free-account flag (key ends in ":fx") without logging the key.
 *
 * @returns The DeepL client plus the key-derived free-account flag.
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
