# Module: renderer workbench

## Files

Primary entrypoints:

- `src/renderer/renderer.ts`
- `src/renderer/app/create-renderer-app.ts`
- `src/renderer/app/feature-registry.ts`
- `src/renderer/sidebar/host.ts`
- `src/renderer/workbench/host.ts`

Feature roots:

- `src/renderer/sidebar/feature.ts`
- `src/renderer/prompts/feature.ts`
- `src/renderer/editor/feature.ts`
- `src/renderer/browser/feature.ts`
- `src/renderer/bottom-panel/feature.ts`

Bootstrap/bindings assembly:

- `src/renderer/bootstrap/renderer-context.ts`
- `src/renderer/bootstrap/install.ts`
- `src/renderer/bootstrap/composition.ts`
- `src/renderer/runtime/subscriptions.ts`

## Purpose

Describe the **current renderer architecture**, not the historical monolith.

The renderer is now a thin entrypoint plus:

1. an app shell
2. grouped mutable store slices
3. region seams (`SidebarHost`, `WorkbenchHost`)
4. lazy feature roots
5. runtime/bootstrap assembly
6. focused surface/runtime modules

## Current ownership model

### 1. Thin entrypoint

`src/renderer/renderer.ts` only starts the app:

- imports `startRendererApp()`
- delegates startup immediately

### 2. App shell

`src/renderer/app/create-renderer-app.ts` is the current composition root.

It owns:

- DOM ref creation
- renderer store creation
- browser controller creation
- shell services creation
- feature-registry creation
- host creation (`SidebarHost`, `WorkbenchHost`)
- bootstrap context assembly
- binding context assembly
- the global `render()` function

This file is much healthier than the old monolith, but it is still the main architectural hotspot.

### 3. Store + services

`src/renderer/app/store.ts` holds renderer-only mutable slices:

- `app`
- `sidebar`
- `browser`
- `menus`
- `dialogs`
- `editor`
- `bottomPanel`

`src/renderer/app/services.ts` groups shell services:

- `desktopPoc`
- `browserController`
- timers
- clipboard
- storage

### 4. Region seams

#### `src/renderer/sidebar/host.ts`

Current responsibility:

- sidebar tab state
- tree-menu lifecycle and delayed close
- sidebar bootstrap/bindings slices
- bridge to sidebar-owned region-runtime helpers

It is a real seam already, and it now fronts a dedicated sidebar region runtime plus a sidebar feature root. It is still not a full region owner in the strongest sense because some sidebar-related state still lives in shared store slices with the transitional `workspace` name.

#### `src/renderer/workbench/host.ts`

Current responsibility:

- active editor tab / paired subtab shell routing
- workbench render coordination
- workbench bootstrap/bindings slices
- browser-controller activation hooks for the workbench region
- browser/local pairing boundary used by bindings

This is the current home for main-workbench shell behavior.
It is closer to the target architecture than before, but it still delegates heavily into browser and editor features.

### 5. Feature roots

#### Workspace feature

`src/renderer/sidebar/feature.ts`

Owns:

- active sidebar project selection logic
- local file-tree loading and cache invalidation
- project tree rendering
- `File view` rendering
- `Remote files` panel rendering and sync helpers

Important note:
The old `workspace` feature root is gone. Sidebar project-tree/new-files behavior now lives under `src/renderer/sidebar/feature.ts`, while local-file ownership lives under `src/renderer/files/*` plus the `files` store slice, and remote-files runtime/state lives under `src/renderer/remote-files/*` plus the `remoteFiles` store slice.
This works, but it is still one of the places where package boundaries are blurrier than ideal.

#### Prompts feature

`src/renderer/prompts/feature.ts`

Owns:

- prompt snapshot refresh
- prompt menu runtime
- prompt-name dialog state
- prompt overlay and prompt sidebar rendering
- prompt editor/view panel rendering

#### Editor feature

`src/renderer/editor/feature.ts`

Owns:

- editor tabs
- prompt tabs
- local chat tabs
- paired browser/local subtab state
- editor-area rendering
- editor-runtime orchestration and tab-state normalization

#### Browser feature

`src/renderer/browser/feature.ts`

Owns:

- browser-opened selection
- startup browser selection/url resolution
- webview lifecycle intent handlers
- sandbox download command/status bridge
- browser/session restore behavior
- paired browser/local launch helpers exposed to the workbench layer

#### Bottom-panel feature

`src/renderer/bottom-panel/feature.ts`

Owns:

- debug log rendering/actions
- terminal orchestration
- bottom-tab switching
- terminal fit and resizer behavior
- Git panel coordination

### 6. Shell-runtime assembly

These files assemble feature options from shell pieces:

- `sidebar/shell-runtime.ts`
- `remote-files/runtime.ts`
- `remote-files/shell-runtime.ts`
- `prompts/shell-runtime.ts`
- `editor/shell-runtime.ts`
- `browser/shell-runtime.ts`
- `bottom-panel/shell-runtime.ts`

They are useful because they keep `createRendererApp()` smaller.
They are also a warning sign: if overused, they can become a second layer of purely mechanical wrappers.

### 7. Bootstrap and bindings assembly

The renderer still has a transitional composition layer:

- `bootstrap/renderer-context.ts`
- `bootstrap/install.ts`
- `bootstrap/composition.ts`
- `bootstrap/bindings.ts`

This layer exists because many DOM event flows and startup flows still need a shared assembly surface.
It is functional, but still flatter and more DTO-like than the target architecture.

## Startup flow

### `startRendererApp()`

1. create the renderer app shell
2. call `bootstrap()`

### `bootstrap()` inside `createRendererApp()`

1. create bootstrap assembly context
2. restore persisted UI state from `localStorage`
3. request bootstrap payload from preload
4. seed renderer store from bootstrap payload
5. install runtime subscriptions
6. initialize webview/browser startup state
7. render current surfaces

## Runtime flow

### Main runtime subscriptions

`src/renderer/runtime/subscriptions.ts` binds:

- app-state updates
- debug entries
- chat-history update events
- terminal data/exit events
- browser webview events
- window resize

The important improvement is that browser and bottom-panel subscriptions now mostly call **intent-style feature actions** rather than mutating shell state directly.

## Current strengths

- `renderer.ts` is no longer the monolith
- region seams now exist for sidebar and workbench
- shell services/store/ui refs are explicit modules
- most surface-local rendering/runtime helpers are extracted
- browser/local pairing is now routed through the workbench seam
- bootstrap and bindings are centralized enough to trace

## Current architecture problems

### 1. `createRendererApp()` is still too large

The main monolith moved, but it still exists as a shell composition hotspot.

### 2. Host seams are only partial owners

`SidebarHost` and `WorkbenchHost` are real improvements, but they still act partly as routing facades over lower-level feature/store state.
They are not yet full owners of their region lifecycle and state.

### 3. The remaining `workspace` store slice is still transitional

It still mixes some concerns that naturally want to be easier to name and isolate:

- sidebar region behavior
- new-files/sidebar coordination
- file/remote-file integration points

That makes ownership harder to read than it should be.

### 4. Bootstrap/bindings assembly is still flat

`renderer-context.ts`, `install.ts`, and `composition.ts` still carry large state/action bags.
The newer `sidebar` / `browser` / `workbench` slices help, but the layer is not yet cleanly decomposed by region.

### 5. Feature registry hides cross-feature coupling

Lazy creation with callbacks keeps the code practical, but it hides how strongly browser/editor/prompts/bottom-panel/sidebar depend on one another.

### 6. No explicit coordinator layer yet

There is still no dedicated place for truly cross-region workflows.
Some of that logic lives in the shell, some in hosts, some in feature wiring.

## Recommended next steps

1. Continue shrinking `createRendererApp()` by moving more bindings/bootstrap ownership into region seams.
2. Keep narrowing bootstrap/bindings assembly from flat bags into region-oriented slices.
3. Decide whether the transitional `workspace` store slice should be renamed or further split into clearer region/domain boundaries.
4. Introduce an explicit coordinator layer only for real cross-region flows.
5. Preserve the rule that new feature logic should not go back into `renderer.ts`.

## Practical guidance

When making renderer changes:

- prefer `src/renderer/app/create-renderer-app.ts` only for true shell composition
- prefer `SidebarHost` / `WorkbenchHost` for region-level shell routing
- prefer feature roots for product behavior
- prefer surface/runtime helpers for local rendering or local event logic
- avoid adding new flat state/action bags unless a slice genuinely belongs to bootstrap/bindings assembly
