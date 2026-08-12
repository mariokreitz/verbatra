---
"@verbatra/studio": patch
---

Key dropdown list items on a stable per-item id instead of the display label. Labels are display strings with no uniqueness guarantee, so two entries reading the same collided on their React key. `DropdownItem` now carries a required `id`.
