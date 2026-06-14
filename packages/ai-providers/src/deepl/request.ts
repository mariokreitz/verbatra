import type { Tone } from "../provider.js";
import type { DeepLTranslateOptions, ProviderNotice } from "./types.js";

/** Inputs to the option builder, all derived from config, key, and request — no key value. */
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

/**
 * Build the translateText options and the observable degradation notices. Tone maps to
 * formality (formal -> "more", informal -> "less", neutral/absent -> omitted). On a free
 * (":fx") key a non-default tone degrades gracefully to default formality (no option
 * sent) with a FORMALITY_DOWNGRADED notice. A configured glossary id is passed natively;
 * a supplied generic term map is ignored with a GLOSSARY_IGNORED notice. Notices carry
 * only a stable code and a static message — never a key or content.
 */
export function buildTranslateOptions(input: TranslateOptionsInput): {
  options: DeepLTranslateOptions;
  notices: ProviderNotice[];
} {
  const notices: ProviderNotice[] = [];

  // Branch on the tone literal so the formality value is derived without a type assertion.
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
