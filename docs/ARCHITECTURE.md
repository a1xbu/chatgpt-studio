# Architecture

## Executive summary

The application is a **desktop workbench around an embedded ChatGPT session**.

It combines five layers:

1. **ChatGPT page layer** — the actual `chatgpt.com` page inside an Electron `webview`
2. **Injected page script** — runs in the page world and observes navigation/network responses
3. **Webview preload bridge** — relays page messages into Electron IPC
4. **Electron main process** — owns app state, persistence, IPC, PTYs, Git inspection, and file/archive operations
5. **Renderer workbench** — displays the IDE-like UI around the embedded browser, local chat history, files, prompts, debug logs, terminal tabs, Git state, and remote-file flows

## Primary goals

- Embed ChatGPT as a first-class browser surface inside a desktop app
- Capture page-level context such as current project and chat
- Capture raw conversation history from backend responses already viewed by the user
- Persist local metadata for bound projects into project folders
- Persist discovered sandbox files and downloaded file paths inside each bound project
- Make previously viewed chats browsable locally
- Provide an IDE-like workspace with debug output, prompts, and shell access

## Deliberate operating model

This PoC is designed around **observation rather than automation**.

The app:

- hosts the official web app
- listens to navigation and backend responses
- stores metadata locally
- never relies on synthetic user action to perform ChatGPT workflows

That boundary is central to the project identity.

## Component map

### 1. Build layer

Files:

- `scripts/build.mjs`
- `package.json`
- `tsconfig.json`

Responsibilities:

- compile TypeScript from `src/` to `dist/`
- inline `src/browser/injected-script.ts` into the generated `guest-preload.js`
- copy static renderer assets and vendor files into `dist/renderer`
- bundle the modular renderer graph back into browser-safe `dist/renderer/renderer.js`

### 2. Browser observation layer

Files:

- `src/browser/guest-preload.ts`
- `src/browser/injected-script.ts`

Responsibilities:

- install the page script as early as possible
- observe ChatGPT URL changes and network activity
- extract current project/chat context
- extract conversation snapshot data and project conversation lists
- parse live stream responses into partial local history updates
- cache backend auth/transport headers in memory
- discover sandbox file links from final assistant answers
- execute queued authenticated file downloads inside the page session
- emit normalized payloads outward

### 3. Main-process domain layer

Files:

- `src/main/main.ts`
- `src/main/project-registry.ts`
- `src/main/project-meta-db.ts`
- `src/main/app-store.ts`
- `src/main/terminal-manager.ts`
- `src/main/project-bundle.ts`
- `src/main/project-archive.ts`

Responsibilities:

- own the Electron window and IPC surface
- maintain temporary and persistent project state
- store bindings in JSON app state
- store project metadata/history in per-project SQLite
- save downloaded sandbox files into each project's `.chatgpt/files/` directory
- manage shell sessions through `node-pty`
- inspect Git state through the system `git` CLI
- broadcast state changes to the renderer

### 4. Renderer bridge layer

Files:

- `src/preload/app-preload.ts`
- `src/renderer/desktop-api.ts`

Responsibilities:

- expose a minimal safe API under `window.desktopPoc`
- shield the renderer from direct Node/Electron access
- define the practical frontend/backend API used by the UI

### 5. Renderer workbench layer

Renderer is no longer modeled as one large controller file. It is now a **thin entrypoint plus app shell, region seams, feature roots, and bootstrap/bindings assembly**.

Key files:

- `src/renderer/renderer.ts` — thin entrypoint that calls `startRendererApp()`
- `src/renderer/app/create-renderer-app.ts` — current composition root and shell bootstrap owner
- `src/renderer/app/store.ts` — mutable renderer-only store slices
- `src/renderer/app/feature-registry.ts` — lazy construction and cross-feature wiring
- `src/renderer/sidebar/host.ts` — sidebar region seam
- `src/renderer/sidebar/region-runtime.ts` — sidebar-owned layout/details/new-files runtime
- `src/renderer/workbench/host.ts` — main-workbench region seam
- `src/renderer/sidebar/feature.ts` — sidebar project-tree/new-files feature root
- `src/renderer/sidebar/shell-runtime.ts` — sidebar feature shell assembly
- `src/renderer/files/feature.ts` — local-files feature root
- `src/renderer/prompts/feature.ts` — prompts feature root
- `src/renderer/editor/feature.ts` — editor feature root
- `src/renderer/browser/feature.ts` — browser feature root
- `src/renderer/bottom-panel/feature.ts` — bottom-panel feature root
- `src/renderer/bootstrap/*` — startup/bootstrap and composed binding assembly

Responsibilities:

- create renderer store, UI refs, shell services, and browser controller
- assemble feature roots and host seams
- restore persisted UI state from `localStorage`
- wire DOM events and runtime subscriptions
- render the sidebar/workbench/bottom-panel surfaces
- coordinate browser/local chat pairing, prompt tabs, remote files, debug logs, terminal tabs, and Git views

### 6. Shared contract layer

Files:

- `src/shared/contracts.ts`
- `src/types/sqljs.d.ts`

Responsibilities:

- shared cross-process data models
- local type support for third-party libraries lacking strict bundled typings

## Runtime boundaries

### Page world

The injected script runs in the ChatGPT page context.

It can:

- inspect `window.location`
- patch `history.pushState` / `replaceState`
- patch `window.fetch`
- patch `XMLHttpRequest`
- parse response bodies that the page already receives
- send structured payloads via `window.postMessage`

It should not:

- depend on Electron APIs
- depend on Node APIs
- mutate app state directly

### Guest preload world

The guest preload can talk both to the page and Electron IPC.

It can:

- execute the injected source early with `webFrame.executeJavaScript(...)`
- listen to `window.postMessage`
- forward messages to the main process using `ipcRenderer.send(...)`

### Main process

The main process owns durable state and privileged capabilities.

It can:

- access the file system
- open dialogs and folders
- manage PTYs
- inspect Git state
- persist JSON and SQLite files
- apply remote files and archives into the project folder
- relay events to the renderer

### Renderer

The renderer owns UI state and interactions.

It can:

- subscribe to state/debug/history/terminal updates through `window.desktopPoc`
- control the `webview`
- render local chat history and terminal output
- store UI preferences in browser `localStorage`
- delegate feature option assembly into focused shell-runtime modules
- delegate sidebar-specific ownership to `sidebar/host.ts` and `sidebar/region-runtime.ts`
- delegate workbench-specific ownership to `workbench/host.ts`
- delegate feature logic to `sidebar`, `files`, `prompts`, `editor`, `browser`, and `bottom-panel`
- delegate startup and event-wiring composition to `bootstrap/*`

It should not:

- touch Node APIs directly
- know implementation details of on-disk persistence

## Renderer architecture in more detail

### Current renderer layers

The current renderer is best understood as six strata.

#### 1. Entry + shell

- `src/renderer/renderer.ts`
- `src/renderer/app/create-renderer-app.ts`
- `src/renderer/app/{store,services,ui-refs,context,state-access,shell-config}.ts`

This layer creates global renderer state and shell dependencies.

#### 2. Region seams

- `src/renderer/sidebar/host.ts`
- `src/renderer/sidebar/region-runtime.ts`
- `src/renderer/workbench/host.ts`

These are the beginnings of real region ownership boundaries.
They currently group bootstrap/bindings/render hooks, browser-controller activation hooks, and route region-specific actions.

#### 3. Feature roots

- `sidebar`
- `files`
- `remote-files`
- `prompts`
- `editor`
- `browser`
- `bottom-panel`

These own most product behavior now.
They expose selectors/actions/render entrypoints and hide most feature-local helpers.

#### 4. Shell-runtime and region-runtime assembly

- `src/renderer/sidebar/region-runtime.ts`
- `src/renderer/sidebar/shell-runtime.ts`
- `src/renderer/remote-files/runtime.ts`
- `src/renderer/remote-files/shell-runtime.ts`
- `src/renderer/prompts/shell-runtime.ts`
- `src/renderer/editor/shell-runtime.ts`
- `src/renderer/browser/shell-runtime.ts`
- `src/renderer/bottom-panel/shell-runtime.ts`

These files build feature options from shell state, services, DOM refs, and host seams.

#### 5. Runtime/bindings assembly

- `src/renderer/bootstrap/renderer-context.ts`
- `src/renderer/bootstrap/install.ts`
- `src/renderer/bootstrap/composition.ts`
- `src/renderer/runtime/subscriptions.ts`

This layer bridges the shell and features into startup/bootstrap and DOM-event/runtime wiring.

#### 6. Focused surface/runtime modules

Examples:

- `src/renderer/files/*`
- `src/renderer/sidebar/*`
- `src/renderer/chat/*`
- `src/renderer/prompts/*`
- `src/renderer/editor/*`
- `src/renderer/browser/*`
- `src/renderer/bottom-panel/*`
- `src/renderer/git/*`
- `src/renderer/render/*`

These modules own most feature-local rendering and pure helpers.

## State model

### Temporary project

A temporary project exists when the app can identify a ChatGPT project but the user has not yet bound it to a local folder.

Properties:

- in-memory only
- shown in the sidebar
- may hold in-memory chat metadata and captured history
- can be promoted to persistent by `Connect Project`

### Persistent project

A persistent project exists when a ChatGPT project is connected to a real folder.

Properties:

- binding stored in app JSON state
- `.chatgpt/meta.db` exists in that folder
- chat metadata and history are persisted there
- local history tabs can be opened from the renderer

### Renderer-only UI state

Renderer keeps additional state that is not persisted by the main process:

- selected/opened sidebar items
- active sidebar tab
- active editor tab and paired subtab
- prompt menu / tree menu / dialog open state
- bottom panel active tab and terminal session view state
- expanded tree/file/archive keys
- runtime download statuses for remote files
- debug filter / retention UI state

That state currently lives in grouped mutable store slices under `src/renderer/app/store.ts`.

## Persistence model

### Global app store

Path:

- `<Electron userData>/state.json`

Stores:

- `ProjectBinding[]`
- project name
- folder path
- project URL
- created/updated timestamps

### Per-project metadata database

Path:

- `<project-folder>/.chatgpt/meta.db`

Stores:

- `project_meta`
- `chats`
- `chat_history`
- `chat_files`
- bundle metadata and file inventory tables

Downloaded file bytes themselves are stored next to the DB under `<project-folder>/.chatgpt/files/`.

## Key architectural decisions

### Early injection without browser extension

Instead of a Chrome extension, the app uses a `webview` preload to execute page-world code very early.

Why it matters:

- simpler PoC setup
- works inside Electron without external browser extension management
- still approximates `document_start`-style behavior

### Separate temporary vs persistent project state

This avoids forcing a folder binding too early.

Benefits:

- the app can observe ChatGPT projects immediately
- the user decides which projects become local projects
- only connected projects create on-disk state

### Per-project database inside the bound folder

The local metadata database is colocated with the user's chosen project folder.

Benefits:

- portability
- easier backup/sync expectations
- clear relationship between local folder and ChatGPT metadata

### Authenticated sandbox-file downloads stay in page context

The app does not try to recreate ChatGPT session credentials in Electron main or renderer code.
Instead, the injected script keeps the last useful backend headers only in page memory, uses those headers to resolve `interpreter/download`, then downloads the file bytes from the returned URL while still inside the authenticated page session.
Only after the bytes are available does the page send them through the page->preload->main bridge for local persistence.

### Thin preload bridge

The renderer talks through a narrow `window.desktopPoc` API instead of broad Electron exposure.

Benefits:

- cleaner layering
- lower accidental coupling
- safer evolution of renderer/main contracts

### Feature-root refactor instead of a full renderer rewrite

Renderer refactoring is being done incrementally.
The project moved from a very large `renderer.ts` monolith toward:

- a thin entrypoint
- a central app shell
- region seams (`sidebar`, `workbench`)
- feature roots
- focused runtime/render helpers

That reduces risk of regressions because behavior is migrated slice by slice instead of being reimplemented from scratch.

## Known complexity hotspots

### `src/browser/injected-script.ts`

This file is fragile because it depends on:

- ChatGPT URL patterns
- response payload structure
- live stream event shapes
- title/network heuristics for project naming

### `src/renderer/app/create-renderer-app.ts`

The old renderer monolith is gone, but the shell is still transitional.

Current concerns:

- it is still roughly a 1000-line composition root
- it assembles large bootstrap/bindings/state bags
- it still owns the final `render()` loop and a broad set of shell-local adapters
- it still knows too much about feature construction details

### `src/renderer/bootstrap/{renderer-context,composition,install}.ts`

This layer still carries large DTO-style state/action bags.
The architecture is healthier than before, but bindings/bootstrap assembly is still flatter than the target region/feature model.

### `src/renderer/app/feature-registry.ts`

The feature registry is useful, but it also hides cross-feature coupling.
Lazy construction with callbacks keeps the app working, but it can obscure true ownership and circular dependencies.

### `src/renderer/sidebar/{feature,shell-runtime}.ts`

The old `workspace` feature root has been removed from the live renderer graph. Sidebar selection sync, project-tree rendering, and new-files panel rendering now live under `src/renderer/sidebar/{feature,shell-runtime}.ts`, while local-files and remote-files continue to live under their dedicated owners.

The remaining transitional piece is the `workspace` **store slice name** inside `src/renderer/app/store.ts`, which still carries sidebar-centric state such as sidebar selection and expansion flags.

## Current renderer target

The intended direction is:

- **shell/layout** — app shell and global services
- **region hosts** — sidebar, main workbench, later bottom panel / notifications if needed
- **feature roots** — sidebar, files, prompts, editor, browser, bottom panel
- **services/bridges** — desktop API, browser controller, timers, clipboard, storage
- **coordinators** — only for real cross-region flows

The codebase is already moving in that direction, but it is not there yet.

For the latest renderer-specific status and debt list, read:

- `docs/modules/renderer-ownership.md`
- `docs/modules/10-renderer-workbench.md`
- `docs/ARCHITECTURE_REVIEW.md`
