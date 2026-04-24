# Module: local types and generated output

## Files

- `src/types/sqljs.d.ts`
- `dist/**`

## `src/types/sqljs.d.ts`

### Purpose

Provide local TypeScript declarations for the subset of `sql.js` APIs used by the project.

### Why it exists

The codebase only needs a small, explicit shape for:

- `Database`
- `Statement`
- `SqlJsStatic`
- `InitSqlJsConfig`

Keeping the local declaration small makes type expectations visible and stable.

## `dist/`

### Purpose

Contains generated build output.

### Contents

- compiled JS for `main`, `preload`, `browser`, `renderer`, `shared`
- copied renderer HTML/CSS
- copied third-party browser assets

### Rule of thumb

Treat `dist/` as disposable generated output.
When reasoning about implementation, always start from `src/`.

### When `dist/` is useful

- verifying build results
- inspecting the post-build inlined guest preload
- confirming that `dist/browser/guest-preload.js` now contains the string-inlined `dist/browser/injected-script.js` source
- packaging/running the app


#### Renderer contract alignment

Recent cleanup removed several duplicate renderer-side declarations in favor of `src/shared/contracts.ts`, reducing mismatches between build-time TypeScript checks and runtime IPC payloads.


#### Renderer-local shared contracts

Renderer-only shared contracts are now split out of `renderer.ts` into dedicated modules:
- `src/renderer/desktop-api.ts`
- `src/renderer/editor/types.ts`
- `src/renderer/sidebar/types.ts`
- `src/renderer/git/types.ts`

This reduces drift between renderer features and makes extracted controllers/helpers import stable shapes instead of re-declaring them ad hoc.
