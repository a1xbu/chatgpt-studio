# Architecture review: current project state

This document reviews the **current** architecture after the renderer refactor up through the `SidebarHost` / `WorkbenchHost` seams and workbench pairing move.

## Verdict

The project is in a **much healthier state than the original renderer monolith**, but the architecture is still transitional.

The renderer now has the right broad direction:

- thin entrypoint
- explicit app shell
- feature roots
- early region seams
- focused runtime/render helpers

However, it has **not yet reached the final target architecture**.
The old monolith mostly moved into a better-shaped shell and bootstrap layer instead of disappearing completely.

## What is already good

### 1. The worst renderer problem is gone

`src/renderer/renderer.ts` is no longer the giant central controller.
That is a real architectural improvement, not just file shuffling.

### 2. Feature roots are real

These modules now own meaningful behavior:

- `sidebar`
- `files`
- `prompts`
- `editor`
- `browser`
- `bottom-panel`

They are not just empty wrappers over `Impl(...)` helpers.

### 3. Region seams now exist

`SidebarHost` and `WorkbenchHost` are the first explicit boundaries aligned to the product UI rather than to implementation style.
That is the right direction.

### 4. Runtime intent handling is better

`runtime/subscriptions.ts` now mostly forwards browser/terminal/webview events into feature actions instead of mutating shell state inline.
That makes side effects easier to localize.

### 5. The refactor has preserved behavior incrementally

This is a strong point.
The migration has been done slice by slice instead of by rewriting the renderer from scratch.
That lowers regression risk.

## Main architectural problems still visible

### 1. `createRendererApp()` is still the real shell monolith

The old monolith moved into a better-named place.
That is progress, but it is still a monolith in practice.

Symptoms:

- around 1000 lines
- creates every shell dependency
- assembles feature options
- assembles bootstrap/bindings contexts
- owns global `render()`
- owns a large number of adapters and bridging closures

This is the single biggest remaining hotspot.

### 2. Bootstrap and bindings assembly is still too flat

`bootstrap/renderer-context.ts`, `bootstrap/install.ts`, and `bootstrap/composition.ts` still depend on large DTO-style bags of state and actions.

This means the architecture is healthier, but the shell still expresses many dependencies as:

- `getX`
- `setY`
- `persistZ`
- `renderSomething`

instead of through smaller region-level contracts.

### 3. Hosts are seams, but not yet full owners

`SidebarHost` and `WorkbenchHost` are meaningful improvements, but they still route into lower-level store/feature state rather than fully owning region lifecycle and state.

That makes them useful, but still partially façade-like.

### 4. The `workspace` feature root is gone, but the store slice is still transitional

The renderer no longer has a live `workspace` feature root. Sidebar selection sync, project-tree rendering, and new-files panel rendering now live under `src/renderer/sidebar/{feature,shell-runtime}.ts`, while local-file and remote-file ownership remain under `files/*` and `remote-files/*`.

What still remains transitional is the `workspace` **store slice name** and the fact that some sidebar-centric state is still stored there. The architectural question is no longer “what belongs in the workspace feature?”, but “when do we rename or further reshape the workspace store slice so the naming matches the code ownership?”

### 5. Cross-feature coupling is still hidden inside the registry and shell

`app/feature-registry.ts` is useful, but it also hides coupling:

- prompts depends on editor
- editor depends on prompts
- browser depends on editor and bottom panel
- bottom panel depends on sidebar project-selection logic

This is practical, but the dependency graph is still denser than the ideal target.

### 6. Pairing ownership improved, but is still split across workbench + browser/editor

Moving pairing under `workbench` was the right decision.
But the runtime behavior still spans:

- `workbench/host.ts`
- `workbench/pairing.ts`
- `browser/feature.ts`
- `editor/feature.ts`

This is better than before, but not yet the final clean model of a single self-contained `ChatPair` workbench item.

### 7. There is still no explicit coordinator layer

Some flows are truly cross-region and should eventually have a dedicated coordinator layer.
Right now those flows are spread across:

- app shell
- hosts
- feature registry
- bootstrap install/composition

### 8. Option bags are still too large

Feature options are still wide, especially for:

- `workspace`
- `browser`
- `editor`
- `bottom-panel`

The new shell-runtime modules helped, but the width of the contracts still shows that boundaries are not fully semantic yet.

### 9. Mutable store slices keep side-effect ordering manual

The renderer store is simple and workable, but it is still a mutable-object model.
That means side-effect ordering is still managed by convention and shell code rather than by a stronger command/update model.

That is acceptable for the current PoC stage, but it remains an architectural constraint.

## Current architecture shape

The renderer today is best described as:

- **entrypoint** — `renderer.ts`
- **app shell** — `app/create-renderer-app.ts`
- **store/services** — `app/*`
- **region seams** — `sidebar/host.ts`, `workbench/host.ts`
- **feature roots** — `sidebar`, `files`, `prompts`, `editor`, `browser`, `bottom-panel`
- **runtime/bindings assembly** — `bootstrap/*`
- **surface helpers** — `files/*`, `chat/*`, `prompts/*`, `editor/*`, `browser/*`, `bottom-panel/*`, `git/*`, `sidebar/*`

That is a solid transitional architecture.
It is not yet the final target of:

- shell/layout
- region hosts
- view/workbench item modules
- services/bridges
- coordinators for cross-region scenarios

## Most important next architectural steps

### 1. Keep shrinking `createRendererApp()`

This remains the top priority.
The goal is not line-count vanity.
The goal is to make the app shell a true composition root instead of a better-organized monolith.

### 2. Keep narrowing bootstrap/bindings by region slices

The current `sidebar` / `browser` / `workbench` grouping is a good start.
Continue this pattern instead of growing the flat bag.

### 3. Decide the future of the `workspace` store slice

The feature root is already gone. The next decision is whether the remaining `workspace` store slice should be renamed or further split so sidebar state stops carrying a misleading name.

### 4. Make hosts own more real region lifecycle

`SidebarHost` and `WorkbenchHost` should evolve from routing seams into stronger region owners.

### 5. Introduce coordinators only where the workflow is truly cross-region

Examples that may justify coordinators later:

- sidebar -> workbench open flows
- browser/local chat pair lifecycle
- overlay/menu/dialog coordination across regions

## Bottom-line recommendation

Do **not** rewrite the renderer from scratch.
The project is already beyond the point where that would be cheaper or safer.

The right strategy remains:

- keep the new shell/feature/host structure
- keep migrating ownership toward product boundaries
- keep narrowing assembly contracts
- do not let the new shell become the final resting place of all complexity
