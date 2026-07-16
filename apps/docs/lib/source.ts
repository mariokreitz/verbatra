import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";
import { i18n } from "@/lib/i18n";

/** The Fumadocs content source for /docs, built from the generated .source output with the site i18n config. */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  i18n,
});
