---
name: JSX preview instrumentation
description: Preview-only parsing failure with explicit generic component arguments.
---

Avoid explicit generic arguments in JSX component tags in this environment; prefer inference with narrowed callbacks.

**Why:** The preview instrumentation inserted metadata attributes before a JSX generic argument, producing invalid syntax even though TypeScript accepted the original source.

**How to apply:** If Vite reports unexpected tokens around generated metadata and a generic component tag, remove the explicit JSX type argument and preserve type safety through typed props or guarded callbacks.
