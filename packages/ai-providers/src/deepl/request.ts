import type { ProviderNotice, Tone } from "../provider.js";
import type { DeepLTranslateOptions } from "./types.js";

export interface TranslateOptionsInput {
  readonly tone?: Tone;
  readonly freeAccount: boolean;
  readonly glossaryId?: string;
  readonly genericGlossarySupplied: boolean;
}

const FORMALITY_DOWNGRADED_MESSAGE =
  "Formality was not applied: the configured DeepL key is a free-tier key, which does not support formality.";
const GLOSSARY_IGNORED_MESSAGE =
  "The supplied glossary term map was not applied: DeepL uses configured glossary IDs, not term maps.";

export function buildTranslateOptions(input: TranslateOptionsInput): {
  options: DeepLTranslateOptions;
  notices: ProviderNotice[];
} {
  const notices: ProviderNotice[] = [];

  let formality: string | undefined;
  if (input.tone === "formal" || input.tone === "informal") {
    if (input.freeAccount) {
      notices.push({ code: "FORMALITY_DOWNGRADED", message: FORMALITY_DOWNGRADED_MESSAGE });
    } else {
      formality = input.tone === "formal" ? "more" : "less";
    }
  }

  if (input.genericGlossarySupplied) {
    notices.push({ code: "GLOSSARY_IGNORED", message: GLOSSARY_IGNORED_MESSAGE });
  }

  const options: DeepLTranslateOptions = {
    ...(formality !== undefined ? { formality } : {}),
    ...(input.glossaryId !== undefined ? { glossary: input.glossaryId } : {}),
  };
  return { options, notices };
}
