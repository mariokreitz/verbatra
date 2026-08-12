---
"@verbatra/studio": patch
---

Read the agent-tools registration status through `useSyncExternalStore` so a publish landing between the render and the effect commit is no longer missed. The hook previously seeded its state in a `useState` initializer during render and subscribed in a `useEffect` after commit; a publish in that gap was lost permanently and the degraded-mode notice would silently never appear.
