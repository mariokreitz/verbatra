---
"@verbatra/ai-providers": patch
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix a broken transitive type dependency leaking through the published `@verbatra/sdk` `.d.ts`.
The Gemini authoring model type was re-exported from `@google/genai`'s own `Interactions.Model`,
but every entry point of that package's type declarations carries an unconditional top-level
import of `@modelcontextprotocol/sdk/client/index.js`, an optional peer dependency it does not
install. A consumer running `tsc --noEmit` with `skipLibCheck: false` got `TS2307: Cannot find
module '@modelcontextprotocol/sdk/client/index.js'` from deep inside `@google/genai`'s own types,
with no fix available on their side short of installing an unrelated MCP SDK package.

`GeminiModel` is now a hand-maintained string literal union (still open-ended via `string & {}`,
so unknown or newly released model IDs are still accepted), breaking the transitive dependency
entirely while preserving editor autocomplete for known Gemini model IDs in `defineConfig`.
