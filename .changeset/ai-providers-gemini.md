---
"@verbatra/ai-providers": minor
---

Add the Gemini provider as the third LLM on the shared LLM layer. It supplies only its own mechanism
behind the existing LlmMechanism extension point, with no change to the shared layer or the
TranslationProvider interface. Gemini uses @google/genai (generateContent with
config.responseMimeType + config.responseSchema); the responseSchema is a dialect transform of the
single canonical derivation (deriveJsonSchema), so all three providers derive from one source. Output
is re-validated on our side by the shared reconcile; blocked, empty, and safety-filtered responses
surface as a new PROVIDER_BLOCKED error (distinct from PROVIDER_REFUSED); the key is read only from
GEMINI_API_KEY; raw SDK errors are never re-thrown. @google/genai pinned 2.8.0.
