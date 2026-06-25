---
"@verbatra/format-adapters": patch
---

fix(format-adapters): tighten vue-i18n placeholder extraction to the real interpolation grammar

The vue-i18n extractor matched any single-brace run (`/\{[^{}]*\}/`), which over-captured: `"Hello {{name}}"` yielded a phantom `{name}`, literal text like `"{curly braces}"` was treated as a placeholder, and `{ name }` did not compare equal to `{name}`.

Extraction now follows vue-i18n's actual grammar: named keys (`{name}`, letters/underscore then letters, digits, underscores, hyphens, dollar signs) and list keys (`{0}`), with inner whitespace normalized to a canonical `{key}` token. Double-brace text (`{{...}}`) and literal interpolation (`{'...'}`) are correctly excluded. Extraction remains linear-time on adversarial input. Closes the H2 finding from the full-stack audit (#19, #21).
