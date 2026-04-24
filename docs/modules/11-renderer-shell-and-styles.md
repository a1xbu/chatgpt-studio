# Module: renderer shell and styles

## Files

- `src/renderer/index.html`
- `src/renderer/styles.css`

## Purpose

Define the static DOM skeleton and the visual system for the Electron workbench.

## `index.html`

### Layout regions

- `.app-shell` — app root
- `.ide-header` — top chrome
- `.sidebar` — project tree + details
- `.workbench` — main area
- `.editor-tabs` — browser/local chat tabs
- `.workspace__toolbar` — browser editor chrome (navigation buttons + address bar)
- `.editor-surface` — browser or local chat content
- `.bottom-panel` — debug console + terminals
- `.drag-shield` — full-screen overlay during resize drags

### Notable static elements

- `<webview id="chatgpt-browser">` hosts ChatGPT
- debug console container
- terminal pane host for xterm
- toolbar buttons for browser navigation and panel control

### External renderer assets

Loaded vendor scripts/styles:

- `xterm.css`
- `xterm.js`
- `addon-fit.js`
- `markdown-it.min.js`

## `styles.css`

### Visual direction

The UI uses a dark, JetBrains/PyCharm-inspired workbench style.

### Major styling areas

- shell and window chrome
- project tree rows and hover actions
- details panel
- editor tabs
- browser toolbar
- chat history cards and reasoning blocks with centered message lanes and fixed gutters
- bottom debug/terminal tabs
- terminal host and empty states
- bottom-panel click-hitbox styling for terminal tabs and close buttons
- drag handles for resizable panels

Tab-bar detail:

- local chat tabs no longer keep a fixed width
- the renderer publishes base/min width CSS variables so tabs compress to fit the bar
- minimum chat-tab width is 30% of the original base width

### Important CSS state classes

- `app-shell--dragging`
- `app-shell--debug-collapsed`
- `workbench--local-tab`
- `editor-tab--active`
- `editor-view--active`
- `bottom-panel-view--active`
- `tree-project--expanded`
- `tree-row--selected`
- `tree-row--opened`
- `terminal-pane--ready`

These classes are the main UI state hooks toggled by the renderer shell and feature/host modules under `src/renderer/*`. In particular, browser chrome visibility is now owned jointly by `renderer/editor/surface.ts`, `renderer/browser/navigation.ts`, `renderer/browser/controller.ts`, `renderer/browser/chrome.ts`, and browser URL normalization helpers in `renderer/browser/urls.ts`, while Remote files tree markup now lives in `renderer/remote-files/panel.ts` instead of inline in the monolith. Bottom-panel runtime behavior is now split further across `renderer/bottom-panel/terminal.ts`, `renderer/bottom-panel/runtime.ts`, and `renderer/debug/clipboard.ts`, while top-tab state commit ordering now lives in `renderer/editor/runtime.ts`. Additional stateful renderer ownership now also lives in `renderer/files/runtime.ts`, `renderer/files/view-runtime.ts`, `renderer/git/runtime.ts`, `renderer/debug/runtime.ts`, `renderer/sidebar/runtime.ts`, `renderer/sidebar/tree-menu.ts`, `renderer/sidebar/project-tree-view.ts`, `renderer/remote-files/runtime-view.ts`, `renderer/render/root.ts`, and `renderer/prompts/runtime.ts`.

## Practical guidance

If you need to change layout or add a control:

1. add or locate the DOM anchor in `index.html` if it is static
2. add styles in `styles.css`
3. connect behavior in `src/renderer/app/create-renderer-app.ts`, the matching host, or the matching feature/surface module

If the UI element is generated dynamically for project/chat rows, tabs, Git panel sections, prompt/editor surfaces, or overlay dialogs, the markup may now live in an extracted module under `src/renderer/*`, not only in the app shell.


### Local chat layout notes

- top-level assistant and user messages share a 90% width cap inside the editor surface
- narrow windows still keep visible gutter instead of stretching messages edge to edge
- wide windows keep both roles near the center line and only offset them slightly to preserve role separation
- nested reasoning/tool cards still stretch to the local container width


## Prompt-related renderer styles

`styles.css` now also includes styles for:

- the `Prompts` sidebar panel
- prompt list rows that reuse the generic tree-row interactions, hover actions, and context-menu trigger behavior
- prompt rows opening only on double-click, so single-click does not steal focus from drag/menu workflows
- shared file-tree palette tokens, so local files and Git commit files stay visually aligned for new / modified / deleted states, while `.gitignore` rows get a separate brown treatment in `File view`
- green-tinted prompt editor tabs
- the simple prompt editor surface and textarea


## Git tab
- The bottom panel now includes a project-bound `Git` tab next to `Debug Console`.
- The tab reloads when the selected project changes and uses the selected project folder as the Git context.
- The tab is hidden when the selected project does not contain `.git` in its root.
- The Git tool window is still read-only, but it now uses a more JetBrains-like layout:
  - left column: grouped local branches with current `HEAD`
  - center column: one-line commit rows with commit graph lanes, colored branch lines, refs, author, and friendly date labels
  - right column: foldable tree of changed files for the selected commit, initially fully expanded, with added paths in dark green, modified paths in blue, deleted paths in dark gray, and directories staying neutral gray
- Git data is loaded through main-process IPC using the system `git` CLI. Commit file trees are fetched lazily for the currently selected commit.
- `.file-tree__*` remains the shared visual baseline for file-like trees; that visual baseline now maps directly to `src/renderer/tree/shared-tree.ts`, while Git commit-file rows add only a compact modifier layer through `src/renderer/git/git-file-tree.ts` instead of a separate widget.


## Renderer startup note

Even though the renderer source is now modular, the shipped workbench still boots from a plain browser script. The build step therefore bundles the compiled renderer module graph back into a single browser-safe `dist/renderer/renderer.js`, so the static `index.html` can keep loading `./renderer.js` without relying on CommonJS globals in the page context. A lightweight guard script at `scripts/smoke-renderer-startup.mjs` now checks that final bundle in a stubbed browser environment so early startup crashes are caught before launching Electron.


#### Shell/controller split progress

The renderer shell now delegates most surface-specific event binding to dedicated modules. Browser chrome stays browser-owned, while files, remote files, editor tabs, bottom panel, Git view, sidebar tree, overlay dialogs, and chat history interactions are bound via extracted event helpers.


#### Browser/runtime ownership

Browser chrome remains browser-owned, but the runtime wiring for webview events and desktop IPC subscriptions now lives in `src/renderer/runtime/subscriptions.ts` rather than inside the monolithic renderer entry.


#### Startup and shell ownership

Shell startup/event-binding composition is now delegated through `bootstrap/init.ts` and `bootstrap/bindings.ts`. Browser-session state resolution is handled separately in `browser/session.ts`, which keeps browser chrome ownership explicit and reduces renderer-entry coupling.


#### Renderer shell ownership after the latest split

The shell/orchestration file still coordinates state, but a larger share of UI composition has moved out: editor tabs/state, overlay dialog composition, sidebar details composition, project-tree runtime composition, File view recursion/composition, remote-files runtime composition, and root render sequencing are now owned by dedicated renderer modules instead of inline blocks inside the old renderer monolith.


The current shell pass also restores the earlier bottom-tab chrome, so the close button stays visually inside the tab instead of floating as a detached control next to it.
