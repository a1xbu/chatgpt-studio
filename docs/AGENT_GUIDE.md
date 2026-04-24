# Agent guide for `electron-chatgpt-poc`

This is the fastest orientation doc for an engineer or coding agent working in this repository.

## One-sentence summary

`electron-chatgpt-poc` is an Electron desktop PoC that embeds `chatgpt.com`, observes project/chat/network state from the live page, persists local metadata into project-bound `.chatgpt/meta.db`, and exposes an IDE-like renderer workbench around that data.

## Non-goals and safety boundary

The project is explicitly built around a **manual user workflow**.

- The user opens and uses ChatGPT manually.
- The app observes the page and network responses.
- The app stores metadata and downloaded files locally.
- The app does not click, type, or submit prompts on the user's behalf.

Preserve that boundary unless product goals clearly change.

## Read this first for renderer work

The renderer is **not** centered on `src/renderer/renderer.ts` anymore.

Read in this order:

1. `docs/ARCHITECTURE.md`
2. `docs/modules/renderer-ownership.md`
3. `docs/ARCHITECTURE_REVIEW.md`
4. `src/renderer/app/create-renderer-app.ts`
5. `src/renderer/app/feature-registry.ts`
6. `src/renderer/sidebar/host.ts`
7. `src/renderer/workbench/host.ts`
8. the feature root for the surface you are changing

## Quick map of the current renderer

### Entry + shell

- `src/renderer/renderer.ts` — thin entrypoint
- `src/renderer/app/create-renderer-app.ts` — current composition root
- `src/renderer/app/store.ts` — renderer-only mutable state
- `src/renderer/app/services.ts` — grouped shell services
- `src/renderer/app/ui-refs.ts` — DOM refs
- `src/renderer/app/context.ts` — shell context + render hooks

### Region seams

- `src/renderer/sidebar/host.ts`
- `src/renderer/sidebar/region-runtime.ts`
- `src/renderer/workbench/host.ts`

### Feature roots

- `src/renderer/sidebar/feature.ts`
- `src/renderer/prompts/feature.ts`
- `src/renderer/editor/feature.ts`
- `src/renderer/browser/feature.ts`
- `src/renderer/bottom-panel/feature.ts`

### Bootstrap / runtime

- `src/renderer/bootstrap/renderer-context.ts`
- `src/renderer/bootstrap/install.ts`
- `src/renderer/bootstrap/composition.ts`
- `src/renderer/runtime/subscriptions.ts`

## Start here depending on the task

### "I need to understand the whole app"

Read in this order:

1. `docs/ARCHITECTURE.md`
2. `docs/DATA_FLOWS.md`
3. `docs/modules/renderer-ownership.md`
4. `src/main/main.ts`
5. `src/main/project-registry.ts`
6. `src/browser/guest-preload.ts`
7. `src/browser/injected-script.ts`
8. `src/renderer/app/create-renderer-app.ts`
9. `src/renderer/app/feature-registry.ts`

### "I need to change renderer composition or startup"

Look at:

- `src/renderer/app/create-renderer-app.ts`
- `src/renderer/bootstrap/renderer-context.ts`
- `src/renderer/bootstrap/install.ts`
- `src/renderer/bootstrap/composition.ts`
- `src/renderer/runtime/subscriptions.ts`

Rule:
Do not put new feature logic in `src/renderer/renderer.ts`.
That file should stay a thin entrypoint.

### "I need to change sidebar behavior"

Look at:

- `src/renderer/sidebar/host.ts`
- `src/renderer/sidebar/shell-runtime.ts`
- `src/renderer/sidebar/feature.ts`
- `src/renderer/sidebar/region-runtime.ts`
- `src/renderer/remote-files/runtime.ts`
- `src/renderer/remote-files/shell-runtime.ts`
- `src/renderer/sidebar/*`
- `src/renderer/files/*`
- `src/renderer/remote-files/*`

### "I need to change main workbench behavior"

Look at:

- `src/renderer/workbench/host.ts`
- `src/renderer/workbench/pairing.ts`
- `src/renderer/editor/feature.ts`
- `src/renderer/browser/feature.ts`
- `src/renderer/editor/*`
- `src/renderer/chat/*`

### "I need to change browser/local pairing"

Look at these together:

- `src/renderer/workbench/host.ts`
- `src/renderer/workbench/pairing.ts`
- `src/renderer/browser/feature.ts`
- `src/renderer/browser/session.ts`
- `src/renderer/browser/shell-runtime.ts`
- `src/renderer/editor/feature.ts`

Rule:
Pairing is now treated as a **workbench concern**, not just a browser concern.

### "I need to change prompts behavior"

Look at:

- `src/renderer/prompts/feature.ts`
- `src/renderer/prompts/shell-runtime.ts`
- `src/renderer/prompts/*`
- `src/renderer/editor/feature.ts` if prompt tabs are involved

### "I need to change terminal / debug / Git behavior"

Look at:

- `src/renderer/bottom-panel/feature.ts`
- `src/renderer/bottom-panel/shell-runtime.ts`
- `src/renderer/bottom-panel/*`
- `src/renderer/debug/*`
- `src/renderer/git/*`
- `src/main/terminal-manager.ts`
- `src/main/main.ts`

### "I need to add or change captured ChatGPT metadata"

Look at:

- `src/browser/injected-script.ts`
- `src/shared/contracts.ts`
- `src/main/project-registry.ts`
- `src/main/project-meta-db.ts`

### "I need to add a new IPC method"

Touch these together:

1. `src/main/main.ts`
2. `src/preload/app-preload.ts`
3. `src/renderer/desktop-api.ts`
4. the relevant renderer shell/feature file, usually `src/renderer/app/create-renderer-app.ts` or a feature root
5. `src/shared/contracts.ts` if the payload crosses processes

### "I need to debug sandbox file discovery or downloads"

Look at these files together:

- `src/browser/injected-script.ts`
- `src/browser/guest-preload.ts`
- `src/main/main.ts`
- `src/main/project-registry.ts`
- `src/main/project-meta-db.ts`
- `src/renderer/browser/feature.ts`
- `src/renderer/sidebar/region-runtime.ts`
- `src/renderer/remote-files/runtime.ts`
- `src/renderer/remote-files/shell-runtime.ts`
- `src/renderer/remote-files/*`

Search terms:

- `captureBackendHeadersFromRequest`
- `buildBackendRequestHeaders`
- `registerSandboxFilesFromText`
- `processSandboxDownloadQueue`
- `resolveSandboxDownload`
- `fetchSandboxDownload`
- `chatgpt-file:register-many`
- `chatgpt-file:save`
- `chatgpt-file:command`
- `chatgpt-file:status`
- `download-automatically-toggle`

## High-value files

### `src/browser/injected-script.ts`

Most fragile file in the repo.
It owns what the app can observe from ChatGPT at all.

### `src/main/project-registry.ts`

Best place to understand runtime state and persistence decisions.
It owns the bridge between observed page data and persisted project metadata.

### `src/renderer/app/create-renderer-app.ts`

Current renderer composition hotspot.
If you need to understand how everything is assembled today, start here.

### `src/renderer/app/feature-registry.ts`

Shows how `sidebar`, `files`, `prompts`, `editor`, `browser`, and `bottom-panel` are lazily created and cross-wired.
If a change crosses multiple features, inspect this file early.

### `src/renderer/sidebar/host.ts` and `src/renderer/workbench/host.ts`

These files show the current direction of travel:
from a giant shell toward explicit region seams.

## Guardrails for renderer changes

### 1. Do not grow `renderer.ts`

Keep it as a thin entrypoint.

### 2. Do not add random logic to `createRendererApp()` unless it is truly shell composition

If the behavior belongs to one region or one feature, put it there.

### 3. Prefer ownership over file-type decomposition

Prefer:

- sidebar / files / remote-files
- workbench / pairing
- prompts
- browser
- bottom-panel

Avoid creating new files only because they are called `events`, `controller`, or `impl` unless they actually create a useful ownership boundary.

### 4. Keep pairing under the workbench seam

Browser/local chat pairing should not drift back into shell glue.

### 5. Keep feature assembly in shell-runtime modules when it is purely composition

Do not dump more mechanical option-bag assembly back into `createRendererApp()`.

### 6. Treat bootstrap/bindings bags as debt, not as a model to copy forever

When possible, narrow them by region slice instead of adding more flat fields.

## Build note for injected-script changes

The page script is authored in TypeScript at `src/browser/injected-script.ts`, but the runnable app does **not** load that file directly.

The authoritative build is `npm run build`:

1. TypeScript is compiled into `dist/`
2. `dist/browser/injected-script.js` is read as plain text
3. its full source is string-inlined into `dist/browser/guest-preload.js`
4. the guest preload executes that inlined source through `webFrame.executeJavaScript(...)`

## Mental model of storage layers

### App-level storage

- `<Electron userData>/state.json`
- owns project bindings and app-level metadata

### Project-level storage

- `<project-folder>/.chatgpt/meta.db`
- owns chats, chat history, chat files, bundle metadata, and related per-project records

### Renderer UI storage

- browser `localStorage`
- owns layout preferences and renderer-only UI affordances such as active sidebar tab, sidebar width, debug retention, and related UI state
