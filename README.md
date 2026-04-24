# Electron ChatGPT Desktop PoC

Minimal Electron desktop PoC that:

- opens `https://chatgpt.com` inside an embedded `webview`
- injects a page script very early through `guest-preload`
- extracts `currentProjectId`, `currentProjectName`, `currentChatId`, and `currentChatName`
- captures raw conversation snapshots from the ChatGPT backend responses
- forwards metadata through `injected script -> guest preload -> IPC -> main process`
- shows temporary and persistent projects in the left sidebar
- lets the user connect a project to a real folder on disk
- creates `.chatgpt/meta.db` inside the connected project folder
- includes a PyCharm-like layout with a resizable sidebar and bottom panel
- includes an embedded multi-tab terminal and debug console
- opens local chat-history tabs from the sidebar for persistent projects
- detects sandbox file links from final assistant answers
- tracks project-local sandbox files and saves downloaded files into `.chatgpt/files/`
- builds a project ZIP bundle from `File view` with `.gitignore` support and excludes `.chatgpt`
- supports native drag-and-drop for local files and the current project bundle into the ChatGPT webview
- shows a resizable `Remote files` panel with manual or automatic download/apply control

## Project layout

```text
src/
  browser/
    guest-preload.ts
    injected-script.ts
    injected-source.ts
  main/
    main.ts
    project-meta-db.ts
    project-registry.ts
    terminal-manager.ts
  preload/
    app-preload.ts
  renderer/
    bottom-panel/
      tabs.ts
      view.ts
    browser/
      navigation.ts
    chat/
      controller.ts
      history.ts
    debug/
      console.ts
    editor/
      surface.ts
      tabs.ts
    files/
      panel.ts
    git/
      git-file-tree.ts
      panel.ts
    layout/
      resizers.ts
    overlay/
      dialogs.ts
    prompts/
      controller.ts
      editor.ts
      prompt-tree.ts
      sidebar.ts
    sidebar/
      details.ts
      project-tree.ts
    tree/
      local-file-tree.ts
      shared-tree.ts
    ui/
      icons.ts
    index.html
    renderer.ts
    styles.css
  shared/
    contracts.ts
scripts/
  build.mjs
```

## Early injection

The PoC follows the same idea as a `document_start` extension flow:

- the `webview preload` starts before page scripts
- it injects the page-world script as early as possible
- metadata is reported back through Electron IPC, without a Chrome extension

## Install

```powershell
npm.cmd install
```

## Build and run

Full build:

```powershell
npm.cmd run build
```

Run Electron using the existing `dist/` output:

```powershell
npm.cmd run start:electron
```

Build and run in one step:

```powershell
npm.cmd run start
```

Optional diagnostic step: compile TypeScript only, without the post-build preload inlining/copy steps:

```powershell
npm.cmd run build:ts
```

`npm run build` is the authoritative build. It compiles TypeScript, then reads `dist/browser/injected-script.js` and inlines that generated JavaScript into `dist/browser/guest-preload.js` by replacing the `INJECTED_SOURCE_PLACEHOLDER`.

## PoC flow

1. The app starts and opens `https://chatgpt.com`.
2. `guest-preload` injects the page script early.
3. The injected script extracts current project/chat metadata and conversation snapshots.
4. The metadata, chat snapshots, and sandbox-file discoveries reach the main process through IPC.
5. Unbound projects appear in `Temporary projects`.
6. `Connect Project` lets the user pick a folder.
7. The app stores the `projectId <-> folderPath` mapping.
8. The app creates `.chatgpt/meta.db` in the selected folder.
9. When sandbox files are downloaded, the bytes are saved into `<project-folder>/.chatgpt/files/...`.

## Internal app storage

The internal store lives under Electron `app.getPath('userData')` as:

```text
<userData>/state.json
```

It stores the project bindings:

- `projectId`
- `projectName`
- `folderPath`

## Project metadata database

When the user connects a project, the app creates:

```text
<project-folder>/.chatgpt/meta.db
```

This SQLite database stores minimal metadata for the PoC:

- known chats
- `chatId`
- `chatName`
- `projectId`
- `projectName`
- persisted chat history snapshots for connected projects
- discovered sandbox files and their download state

## Current scope

Implemented:

- embedded ChatGPT browser area
- early injected metadata bridge
- conversation history capture from backend snapshots
- temporary vs persistent projects
- project-to-folder bindings
- `.chatgpt/meta.db` creation
- local chat-history tabs in the editor area with centered message lanes
- resizable sidebar
- global Prompts sidebar tab backed by Markdown files in the Electron userData directory
- collapsible bottom panel
- debug console with filtering and retention
- embedded multi-tab terminal

Not implemented:

- chat stream capture
- advanced search over local chat history
- production-grade hardening
- robust long-term compatibility with changing ChatGPT internal download APIs

## Files view, project bundle, drag-and-drop, and remote files

### Files view

The `File view` tab renders a local project tree for the currently connected project.
The project title keeps its original casing, exposes `Open project folder`, `Refresh`, and `Create bundle` actions, and shows a draggable `Project bundle` card above the tree separator when a bundle exists.
Directory expand/collapse preserves scroll position and only refreshes the file-view subtree instead of rebuilding the active local chat view.
The local file tree, Git commit file tree, and prompt rows now share the same renderer-side tree-row primitive end-to-end, including row actions and context-menu triggers, so drag, click, hover actions, and future per-row behavior can stay aligned.
Files matched by the repository's `.gitignore` are tinted brown in `File view`, including ignored directories. The renderer also ignores synthetic creation timestamps caused by ZIP extraction / copy-on-write cases so an extracted repo does not paint every file as "new". The Git panel `Files` section reuses the same status palette tokens for added / modified / deleted file rows.

### Project bundle

`Create bundle` builds a ZIP archive inside `<project-folder>/.chatgpt/bundles/`.
The bundle creator:

- reads `.gitignore` from the project root when present
- always excludes `.chatgpt` even if `.gitignore` does not mention it
- records bundle metadata in `project_bundle`
- records a full file index with size, mtime, and SHA-256 in `project_bundle_files`

### Native drag-and-drop

Both local files from `File view` and the current `Project bundle` card can be dragged out of the Electron UI into the embedded ChatGPT webview.
The main process uses Electron `webContents.startDrag(...)` with a real PNG asset on disk as the drag icon.

### Remote files and apply

The sidebar now contains a resizable `Remote files` panel that defaults to 50% of the left-pane height.
It renders assistant-produced sandbox files as a tree, including expandable ZIP archives, download/apply actions, and a bottom-aligned `Apply all` action.

When a downloaded ZIP contains a valid `.chatgpt-remote/manifest.json` for the current `project_id`, the app marks the file as a project archive in `chat_files.is_project` and automatically applies it to the connected project.


## Prompts

The left sidebar now contains a `Prompts` tab. Prompts are stored as `.md` files in `app.getPath('userData')/prompts`.

- the prompts list is loaded by enumerating that directory
- the directory is created automatically when needed
- `Open folder` opens the prompts directory in the OS file manager
- `New prompt` creates a new Markdown prompt file
- prompt rows are rendered through the same shared tree-row primitive used by the file tree and Git commit file tree
- prompt rows expose a hover `...` menu with `Rename` and `Delete`
- the same menu can also be opened with right-click on a prompt row
- single-click keeps the row idle; prompts open only on double-click or through the row menu
- prompt editor tabs use a green-tinted tab style and autosave on edit, with `Ctrl+S` supported


## Git tab
- The bottom panel now includes a project-bound `Git` tab next to `Debug Console`.
- The tab reloads when the selected project changes and uses the selected project folder as the Git context.
- The tab is hidden when the selected project does not contain `.git` in its root.
- The Git tool window is still read-only, but it now uses a more JetBrains-like layout:
  - left column: grouped local branches with current `HEAD`
  - center column: one-line commit rows with commit graph lanes, colored branch lines, refs, author, and friendly date labels
  - right column: foldable tree of changed files for the selected commit, initially fully expanded, with added paths in dark green, modified paths in blue, deleted paths in dark gray, and directories staying neutral gray
- Git data is loaded through main-process IPC using the system `git` CLI. Commit file trees are fetched lazily for the currently selected commit.
- The commit-file tree reuses the same renderer tree primitive as `File view`, but with drag-and-drop and hover actions disabled.

## Renderer decomposition direction

`src/renderer/renderer.ts` is still the main renderer orchestrator, but the split is now materially underway: the file went from roughly `7410` lines down to about `2515` while keeping the existing plain-TypeScript renderer architecture.

Already extracted renderer slices:

- `renderer/tree/shared-tree.ts` — shared tree-row primitive and row action buttons
- `renderer/tree/local-file-tree.ts` — local `Files` tree rows
- `renderer/git/git-file-tree.ts` — commit-file tree builder / renderer
- `renderer/git/panel.ts` — Git panel markup / commit graph / branch groups
- `renderer/git/runtime.ts` — Git tab loading, commit-details refresh, and project-sync runtime helpers
- `renderer/prompts/prompt-tree.ts` — prompt rows and prompt row menu
- `renderer/prompts/menu.ts` — prompt action-menu portal rendering and toggle/runtime helpers
- `renderer/prompts/sidebar.ts` — Prompts sidebar panel markup
- `renderer/prompts/editor.ts` — prompt editor DOM renderer / status text
- `renderer/prompts/controller.ts` — prompt open/load/save controller helpers
- `renderer/prompts/dialog-runtime.ts` — prompt create/rename dialog state + submit flows
- `renderer/prompts/runtime.ts` — prompt snapshot refresh and prompt-editor mode runtime helpers
- `renderer/chat/history.ts` — local chat DOM rendering helpers
- `renderer/chat/controller.ts` — local chat loading controller helpers
- `renderer/chat/format.ts` — chat-history role/timestamp/code-fence formatting helpers
- `renderer/editor/tabs.ts` — top editor tab bar markup
- `renderer/editor/surface.ts` — browser/local/prompt editor-surface switching
- `renderer/editor/runtime.ts` — state-first top-tab activation/open/close runtime orchestration
- `renderer/editor/view.ts` — top-tab bar rendering + editor-area composition
- `renderer/editor/runtime-adapter.ts` — shared adapter that composes editor-tab runtime callbacks/state accessors
- `renderer/bottom-panel/tabs.ts` — bottom tab strip markup
- `renderer/bottom-panel/view.ts` — bottom-panel view selection / terminal viewport sync
- `renderer/bottom-panel/terminal.ts` — xterm/session state helpers and fit scheduling
- `renderer/bottom-panel/runtime.ts` — bottom-panel tab switching + terminal open/close runtime actions
- `renderer/bottom-panel/runtime-view.ts` — bottom-panel UI/runtime wrappers for terminal viewport + tab rendering
- `renderer/sidebar/project-tree.ts` — Projects tree markup
- `renderer/sidebar/project-tree-view.ts` — Projects tree runtime/view composition
- `renderer/sidebar/details.ts` — sidebar details pane markup
- `renderer/sidebar/queries.ts` — shared project/chat lookup helpers
- `renderer/prompts/tab-runtime.ts` — prompt-tab runtime controller wrapper
- `renderer/prompts/view-runtime.ts` — prompt menu/sidebar runtime composition helpers
- `renderer/bootstrap/ui-state.ts` — persisted renderer UI-state bootstrap helper
- `renderer/bootstrap/composition.ts` — startup/bootstrap and DOM-binding composition wrappers
- `renderer/sidebar/runtime.ts` — persisted sidebar/debug layout state helpers
- `renderer/sidebar/tree-menu.ts` — project/chat tree action menu markup helpers
- `renderer/files/panel.ts` — local Files panel markup and bundle card
- `renderer/files/activity.ts` — local file recent/new/modified classification helpers
- `renderer/files/discovery.ts` — shared chat-file discovery helpers for Files/Remote files flows
- `renderer/files/runtime.ts` — local-file tree, archive-entry, and remote-file apply runtime helpers
- `renderer/files/view-runtime.ts` — local Files tree recursion and File view runtime composition
- `renderer/debug/console.ts` — Debug Console markup
- `renderer/debug/actions.ts` — debug-log append/copy/clear action helpers
- `renderer/debug/clipboard.ts` — clipboard copy helper with DOM fallback
- `renderer/debug/runtime.ts` — debug-log filtering, retention, and console render helpers
- `renderer/browser/navigation.ts` — browser toolbar/navigation state helpers
- `renderer/browser/controller.ts` — browser navigation state wrapper used by the main orchestrator
- `renderer/browser/chrome.ts` — browser toolbar/address-bar event wiring
- `renderer/browser/webview-events.ts` — webview lifecycle event binding
- `renderer/browser/downloads.ts` — browser sandbox-file command/status + auto-download runtime helpers
- `renderer/browser/pairing.ts` — browser/local paired-chat selection, browser-open helpers, and local-chat launch routing
- `renderer/browser/urls.ts` — ChatGPT project/chat URL normalization and reconstruction helpers
- `renderer/runtime-types.ts` + `renderer/globals.d.ts` — renderer-only runtime typings for browser globals
- `renderer/layout/resizers.ts` — shared splitter / drag-resize helpers
- `renderer/render/root.ts` — root workbench render orchestration
- `renderer/overlay/dialogs.ts` — modal / overlay dialog markup helpers
- `renderer/ui/menu-runtime.ts` — shared delayed-close/toggle helpers for floating menus
- `renderer/prompts/events.ts` — prompt sidebar/editor event wiring
- `renderer/remote-files/panel.ts` — Remote files panel/tree/archive markup helpers
- `renderer/remote-files/runtime-view.ts` — Remote files sidebar runtime/view wrapper
- `renderer/sidebar/storage.ts` — localStorage-backed sidebar/debug/layout load helpers
- `renderer/ui/icons.ts` — shared SVG icon helpers

`renderer.ts` still owns renderer-wide state, startup bootstrap, part of the global event wiring, DOM patch scheduling, IPC coordination, and cross-view orchestration. The next safe refactor remains incremental rather than a rewrite:

- `renderer/app-shell/*` for startup bootstrap, root render orchestration, splitters, and tab chrome
- `renderer/state/*` for persisted UI preferences, caches, and selection state
- `renderer/browser/*` for browser/webview lifecycle and command plumbing
- `renderer/sidebar/*` for higher-level panel controllers (not just markup)
- `renderer/remote-files/*` for download/archive/apply pipeline orchestration
- `renderer/services/*` for typed IPC adapters and browser command plumbing

The important constraint is still to keep behavior-preserving flow: first move pure render helpers, then local controller/state helpers, and only after that move global event wiring and side effects.


### Renderer build note

The renderer source is now intentionally split across many CommonJS-compiled helper modules, but the final shipped `dist/renderer/renderer.js` is browser-safe again: `scripts/build.mjs` now bundles the compiled renderer module graph back into a single in-browser entry script, so Electron still loads the workbench through a plain `<script src="./renderer.js">` without depending on Node globals inside the page.

There is now also a lightweight startup smoke-check at `scripts/smoke-renderer-startup.mjs`. It evaluates the final bundled renderer in a stubbed DOM/runtime shell and fails fast if the browser bundle would crash before bootstrap finishes.


## Renderer modularization progress: event wiring

The latest refactor step extracts most remaining DOM listener groups from `src/renderer/renderer.ts` into focused `events.ts` modules (`remote-files`, `files`, `editor`, `bottom-panel`, `git`, `sidebar`, `overlay`, `chat`). The renderer entry now acts more like an orchestrator around shared state, startup, and cross-view coordination.


### Shared renderer contracts

Renderer-side modules now reuse file/chat/prompt/project types from `src/shared/contracts.ts` instead of re-declaring near-identical local copies. This reduces drift between IPC payload shapes, renderer helpers, and panel-specific modules.


## Renderer modularization progress (step 5)

This step extracts another large slice from `src/renderer/renderer.ts`:
- shared renderer-side contracts moved to `src/renderer/desktop-api.ts`, `src/renderer/editor/types.ts`, `src/renderer/sidebar/types.ts`, and `src/renderer/git/types.ts`
- runtime/webview/IPC subscriptions moved to `src/renderer/runtime/subscriptions.ts`
- interaction/controller helpers moved to:
  - `src/renderer/remote-files/controller.ts`
  - `src/renderer/files/controller.ts`
  - `src/renderer/git/controller.ts`
  - `src/renderer/sidebar/controller.ts`
  - `src/renderer/overlay/controller.ts`
  - `src/renderer/bottom-panel/controller.ts`

`renderer.ts` is now primarily state/orchestration/bootstrap glue, while listener/controller bodies live closer to their feature areas.


## Renderer modularization progress

Latest refactor step extracted browser-session helpers plus bootstrap orchestration and DOM binding composition into dedicated modules:
- `src/renderer/browser/session.ts`
- `src/renderer/bootstrap/init.ts`
- `src/renderer/bootstrap/bindings.ts`

`renderer.ts` now delegates startup orchestration and event-binding composition instead of holding those bodies inline.


## Renderer modularization progress

Latest step extracted more renderer-side orchestration into focused modules:
- `src/renderer/editor/controller.ts`
- `src/renderer/render/workbench.ts`
- `src/renderer/overlay/view.ts`
- `src/renderer/sidebar/view.ts`
- `src/renderer/remote-files/view.ts`

This moved editor-tab state/lifecycle helpers and several view-model/render blocks out of `renderer.ts` while preserving the same runtime bootstrap and bundled renderer delivery.

## Renderer modularization progress

Latest steps continue the workbench runtime split:
- `src/renderer/bottom-panel/terminal.ts`
- `src/renderer/bottom-panel/runtime.ts`
- `src/renderer/debug/clipboard.ts`
- `src/renderer/editor/runtime.ts`

This keeps terminal/session lifecycle helpers, clipboard fallback logic, and now the state-first editor-tab activation/open/close runtime out of `renderer.ts`.

The editor runtime change also fixes the top tab bar regression introduced during decomposition: tab activation/render/persist/sync now happens only after the new editor state is committed, so switching no longer needs a second click and close/switch flows stay in sync with the visible active tab. Bottom-tab chrome was also restored to the earlier layout so the close button stays visually inside the tab again.


## Renderer modularization progress

Latest step extracts more stateful runtime slices out of `renderer.ts`:
- `src/renderer/files/runtime.ts`
- `src/renderer/git/runtime.ts`
- `src/renderer/debug/runtime.ts`
- `src/renderer/sidebar/runtime.ts`
- `src/renderer/sidebar/tree-menu.ts`
- `src/renderer/prompts/runtime.ts`

This keeps file/archive caches, Git reload flows, debug-console filtering/rendering, persisted sidebar/debug layout state, project/chat tree menu markup, and prompt refresh/edit-mode helpers out of the main renderer entry.


## Renderer modularization progress

Latest step keeps shaving orchestration helpers out of `renderer.ts`:
- `src/renderer/browser/downloads.ts`
- `src/renderer/debug/actions.ts`
- `src/renderer/prompts/dialog-runtime.ts`
- `src/renderer/prompts/menu.ts`
- `src/renderer/ui/menu-runtime.ts`

This moves browser sandbox download command/status handling, debug copy/clear/append helpers, prompt create/rename dialog flows, prompt floating-menu portal logic, and shared delayed menu-close behavior into focused modules. `src/renderer/browser/session.ts` also now owns restore-last-open-state behavior, so the renderer entry is a bit less responsible for session recovery details.

A follow-up step also split out `src/renderer/sidebar/queries.ts`, `src/renderer/chat/format.ts`, `src/renderer/editor/view.ts`, `src/renderer/bottom-panel/runtime-view.ts`, `src/renderer/prompts/tab-runtime.ts`, and `src/renderer/bootstrap/ui-state.ts`. That keeps project/chat lookup helpers, chat-history formatting, top-editor-area composition, bottom-panel terminal/view wrappers, prompt-tab controller wiring, and persisted UI bootstrap state out of the main renderer entry.


## Renderer modularization progress

Latest step keeps moving composition/orchestration glue out of `renderer.ts`:
- `src/renderer/bootstrap/composition.ts`
- `src/renderer/browser/pairing.ts`
- `src/renderer/editor/runtime-adapter.ts`
- `src/renderer/prompts/view-runtime.ts`

This shifts bootstrap option assembly, DOM-binding composition, paired browser/local chat helpers, shared editor-runtime callback wiring, and prompt menu/view composition into dedicated modules. The renderer entry is slimmer and closer to a stateful shell around feature slices rather than the place where all composition logic lives.

A newer follow-up step also moves more view/runtime ownership out of the entry file:
- `src/renderer/sidebar/project-tree-view.ts`
- `src/renderer/files/view-runtime.ts`
- `src/renderer/remote-files/runtime-view.ts`
- `src/renderer/render/root.ts`

That keeps project-tree runtime composition, local Files tree recursion, File view composition, Remote files sidebar rendering, and root workbench render sequencing out of `renderer.ts`, while `src/renderer/browser/pairing.ts` now also owns local-chat -> browser launch routing.