import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

// The content tree lives at apps/docs/content/docs (committed in WS6). meta.json there
// drives the sidebar order; this loader exposes it to the layout and the page route.
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
