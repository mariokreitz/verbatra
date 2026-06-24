---
"@verbatra/core": patch
---

fix(core): compare placeholders as multisets so dropped or duplicated placeholders report as missing or extra instead of a mislabeled reorder

`checkPlaceholders` now counts placeholder occurrences instead of collapsing them into sets. A dropped occurrence lands in `missing`, a surplus occurrence lands in `extra` (each carrying its multiplicity), and only a genuine same-multiset-different-order case is reported as `reordered`. The result shape is unchanged.
