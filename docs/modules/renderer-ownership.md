# Renderer ownership map

This document tracks which module owns each renderer feature slice and what still remains inside `src/renderer/renderer.ts`.

| Feature | Owner module | State owned | Public actions / entrypoints | Still in `renderer.ts` |
| --- | --- | --- | --- | --- |
| Renderer entrypoint | `src/renderer/renderer.ts` | Start-up delegation only | `startRendererApp()` | No |
| Renderer app shell | `src/renderer/app/create-renderer-app.ts` | Global `render()`, entry `bootstrap()`, shell composition/bootstrap over feature registry and runtime adapters | `createRendererApp()`, `bootstrap()`, `render()` | Thinner composition root only |
| Sidebar host | `src/renderer/sidebar/host.ts` | Sidebar region host wiring over sidebar layout/details/new-files region runtime, sidebar tab state, and tree-menu lifecycle/bindings slices | `createRendererSidebarHost(...)`, `sidebarHost.createBootstrapSlice()`, `sidebarHost.createBindingsSlice()` | No |
| Sidebar tree-menu runtime | `src/renderer/sidebar/tree-menu-runtime.ts` | Managed tree-menu close/schedule lifecycle bridged from renderer context into sidebar interactions | `createRendererTreeMenuRuntime(...)` | No |
| Sidebar region runtime | `src/renderer/sidebar/region-runtime.ts` | Sidebar-owned layout/details/new-files sizing, shared-tree rendering, sidebar-details rendering, and expanded-project persistence | `createSidebarRegionRuntime(...)` | No |
| Renderer store | `src/renderer/app/store.ts` | Root mutable renderer state grouped as app/workspace/files/remote-files/browser/menus/dialogs/editor/bottom-panel slices | `createRendererStore(...)`, runtime state getters/setters for browser/editor/prompt-menu/bottom-panel/git | No |
| Renderer shell config | `src/renderer/app/shell-config.ts` | Shell-level limits, storage keys, and remote-file constants | `rendererShellConfig` | No |
| Renderer UI refs | `src/renderer/app/ui-refs.ts` | DOM lookup / overlay-root creation for renderer shell elements | `createRendererUiRefs(...)`, `ensureOverlayRoot(...)` | No |
| Renderer app services | `src/renderer/app/services.ts` | Desktop API, browser controller, timers, storage, clipboard grouped as shell services | `createRendererAppServices(...)` | No |
| Renderer context | `src/renderer/app/context.ts` | Context composition over services, tree-menu state-access, and shell render hooks | `createRendererContext(...)`, tree-menu runtime option builder | No |
| State access adapters | `src/renderer/app/state-access.ts` | Getter/setter adapters for app, tree-menu, editor, and bottom-panel slices | `createRendererStateAccess(...)` | No |
| Feature registry / composition | `src/renderer/app/feature-registry.ts` | Lazy feature construction and cross-feature wiring for sidebar/files/prompts/editor/browser/bottom-panel | `createRendererFeatureRegistry(...)`, `rendererFeatures.composition()` | No |
| Shell utilities | `src/renderer/app/utils.ts` | Stateless shell helpers for HTML escaping, timestamps, file sizes, DOM target lookup | `escapeHtml(...)`, `formatTimestamp(...)`, `formatFileSize(...)`, `findClosestHtmlElement(...)` | No |
| Sidebar feature | `src/renderer/sidebar/feature.ts` | Sidebar selection sync, project-tree rendering, new-files panel rendering, and sidebar-wide render orchestration | `sidebar.render.sidebar()`, `sidebar.actions.syncSidebarSelection()`, `sidebar.selectors.getActiveSidebarProject()` | Thin state bridges only |
| Sidebar shell runtime | `src/renderer/sidebar/shell-runtime.ts` | Sidebar-specific shell assembly for feature options that adapt store state and remote-files selectors into the sidebar feature root | `createRendererSidebarFeatureOptions(...)` | No |
| Files feature | `src/renderer/files/feature.ts` plus `src/renderer/files/{selectors,actions,render}.ts` | Local file-tree loading/cache invalidation, file-view rendering, project-file signatures, bundle/file-tree UI state | `files.render.fileViewPanel()`, `files.actions.loadLocalFileTree()`, `files.actions.refreshLocalProjectTree()` | No |
| Files shell runtime | `src/renderer/files/shell-runtime.ts` | Files-specific shell assembly for feature options that adapt sidebar tree helpers, file-store state, and remote-files archive state into the files feature root | `createRendererFilesFeatureOptions(...)` | No |
| Remote-files runtime | `src/renderer/remote-files/runtime.ts` | Remote-files apply/archive/download orchestration backed by the dedicated `remoteFiles` store slice instead of the workspace bucket | `createRendererRemoteFilesRuntime(...)` | No |
| Remote-files shell runtime | `src/renderer/remote-files/shell-runtime.ts` | Remote-files-specific shell assembly for apply/archive/download bindings and storage wiring | `createRendererRemoteFilesBindingsSlice(...)` | No |
| Prompts feature | `src/renderer/prompts/feature.ts` plus `src/renderer/prompts/*` | Prompt directory snapshot, prompt menu runtime, prompt-name dialog, overlay dialog state transitions, prompt sidebar/menu rendering | `prompts.actions.refreshPrompts()`, `prompts.actions.openCreatePromptDialog()`, `prompts.render.overlayDialog()`, `prompts.render.viewPanel()` | No |
| Prompts shell runtime | `src/renderer/prompts/shell-runtime.ts` | Prompt-specific shell assembly for feature base options and dialog/menu state wiring | `createRendererPromptsFeatureBaseOptions(...)` | No |
| Editor feature | `src/renderer/editor/feature.ts` | Editor tabs, active tab coordination, paired browser/local tab state, prompt-tab runtime glue | `editor.render.area()`, `editor.actions.openPromptTab()`, `editor.actions.ensureChatHistoryTab()`, `editor.selectors.findPromptEditorTab()` | Thin state bridges only |
| Editor shell runtime | `src/renderer/editor/shell-runtime.ts` | Editor-specific shell assembly for feature base options and persisted local-chat selection wiring | `createRendererEditorFeatureBaseOptions(...)` | No |
| Main workbench host | `src/renderer/workbench/host.ts` plus `src/renderer/workbench/pairing.ts` | Main-workbench render/bindings/bootstrap coordination, browser/local pairing orchestration boundary, active paired-view shell routing | `createRendererWorkbenchHost(...)`, `workbenchHost.createBootstrapSlice()`, `workbenchHost.createBindingsSlice()`, `workbenchHost.createBrowserControllerHooks()` | No |
| Browser feature | `src/renderer/browser/feature.ts` plus `src/renderer/browser/*` | Browser opened selection rules, startup browser resolution, sandbox download bridge, webview runtime lifecycle intents | `browser.actions.queueAutomaticSandboxDownloads()`, `browser.actions.handleWebviewDidStartLoading()`, `browser.actions.handleBrowserSandboxFileStatus()` | Thin state bridges only |
| Browser shell runtime | `src/renderer/browser/shell-runtime.ts` | Browser-specific shell assembly for feature base options and persisted browser/opened-selection wiring | `createRendererBrowserFeatureBaseOptions(...)` | No |
| Bottom panel feature | `src/renderer/bottom-panel/feature.ts` plus `src/renderer/bottom-panel/*` | Terminal orchestration, debug logs render/actions, git panel coordination, bottom-tab switching, terminal fit/resizer glue, terminal runtime intents | `bottomPanel.render.bottomPanel()`, `bottomPanel.actions.openEmbeddedTerminal()`, `bottomPanel.actions.refreshGitPanel()`, `bottomPanel.actions.handleTerminalData()` | Thin state bridges only |
| Bottom-panel shell runtime | `src/renderer/bottom-panel/shell-runtime.ts` | Bottom-panel-specific shell assembly for feature base options and grouped debug/terminal/git runtime wiring | `createRendererBottomPanelFeatureBaseOptions(...)` | No |

## Current status

- `renderer.ts` is now a thin entrypoint that delegates startup into `src/renderer/app/create-renderer-app.ts` instead of owning shell composition directly.
- The app-shell composition/bootstrap flow now lives in `src/renderer/app/create-renderer-app.ts`, making the renderer entry explicit and keeping shell ownership under `src/renderer/app/*`.
- Root mutable renderer state no longer initializes inline inside `renderer.ts`; it moved to `src/renderer/app/store.ts` and is consumed as grouped store slices.
- Shell DOM lookup, timers/storage/clipboard grouping, and shell constants no longer live inline inside `renderer.ts`; they moved to `src/renderer/app/{ui-refs,services,shell-config}.ts`.
- The lazy feature builders no longer live inside `renderer.ts`; they moved to `src/renderer/app/feature-registry.ts`.
- Prompt menu/dialog/overlay ownership no longer lives in `renderer.ts`; it moved to `src/renderer/prompts/feature.ts` and is consumed through the feature registry.
- `RendererContext` no longer carries prompt-menu runtime plumbing; prompt-menu ownership moved directly under the prompts feature.
- Remaining shell-owned browser/git helper wrappers and entry bootstrap/render flow now live under `src/renderer/app/create-renderer-app.ts`; workspace-specific layout/storage adapters no longer live inline in the entry file.
- Tree-menu close/schedule plumbing no longer lives inline in `create-renderer-app.ts`; it moved under the sidebar region host and is backed by `src/renderer/sidebar/tree-menu-runtime.ts`.
- Editor-specific shell assembly for feature base options and persisted local-chat selection wiring no longer lives inline in `renderer.ts`; it moved to `src/renderer/editor/shell-runtime.ts`.
- Browser-specific shell assembly for feature base options no longer lives inline in `renderer.ts`; it moved to `src/renderer/browser/shell-runtime.ts`.
- Prompt-specific shell assembly for feature base options no longer lives inline in `create-renderer-app.ts`; it moved to `src/renderer/prompts/shell-runtime.ts`.
- Bottom-panel-specific shell assembly for feature base options no longer lives inline in `create-renderer-app.ts`; it moved to `src/renderer/bottom-panel/shell-runtime.ts`.
- Runtime subscriptions no longer push browser/terminal/editor state through shell-level setter plumbing; they now call intent-style feature APIs on browser/editor/bottom-panel.
- Sidebar-owned layout/storage/render adapters for sidebar/new-files/shared-tree rendering no longer live inline in `renderer.ts`; they moved into `src/renderer/sidebar/region-runtime.ts`.
- Sidebar-specific layout/details/tree-menu ownership no longer hangs off ad-hoc shell locals; it is grouped behind `src/renderer/sidebar/host.ts` and consumed by sidebar/editor/browser shell assembly as a region host seam.
- Sidebar tab persistence and tree-menu bindings/bootstrap slices no longer get assembled inline in `create-renderer-app.ts`; they are now produced by `SidebarHost`, so the app shell no longer owns those sidebar-specific adapters directly.
- Sidebar feature option assembly no longer lives inline in `create-renderer-app.ts`; it now lives in `src/renderer/sidebar/shell-runtime.ts` and consumes active sidebar tab/tree-menu state through `SidebarHost` instead of raw store/menu slices.
- Files feature option assembly and local file-view/file-tree ownership no longer sit inside `workspace/*`; they now live under `src/renderer/files/{feature,shell-runtime}.ts`.
- Sidebar-owned layout/details/new-files runtime no longer sits in `workspace/runtime.ts`; it now lives under `src/renderer/sidebar/region-runtime.ts`, which better matches real region ownership.
- Local file caches/signatures/bundle UI state no longer live in the workspace store bucket; they now live in the dedicated `files` store slice.
- Remote-files apply/archive/download runtime and binding assembly no longer sit under `workspace/*`; they now live under `src/renderer/remote-files/runtime.ts` and `src/renderer/remote-files/shell-runtime.ts`.
- Remote-files archive/download/notice state no longer lives in the workspace store bucket; it now lives in the dedicated `remoteFiles` store slice.
- Shell timer contracts now use explicit DOM timer signatures instead of `typeof window.setTimeout` / `clearTimeout`, which avoids Node+DOM type collisions in full-project builds.

## Current debt still visible from the ownership map

1. `src/renderer/app/create-renderer-app.ts` is still the real shell hotspot even though `renderer.ts` is now thin.
2. `SidebarHost` and `WorkbenchHost` are meaningful seams, but not yet full region owners.
3. Bootstrap/bindings assembly still depends on broad state/action bags.
4. The old `workspace` feature root is gone, but the remaining `workspace` store slice name is still transitional and sidebar/files/remote-files ownership still overlaps conceptually.
5. The feature registry still hides a dense cross-feature dependency graph.

## Maintenance rule

Keep this map updated whenever ownership moves again.

## Main workbench host seam

- `src/renderer/workbench/host.ts` now owns shell-level coordination for the main workbench region.
- It provides a region boundary for:
  - active editor tab state updates used by browser/editor integration
  - workbench render coordination (`browser` sync + editor area + prompt sidebar)
  - workbench-specific context hooks used by renderer runtime
- `create-renderer-app.ts` now uses `RendererWorkbenchHost` instead of assembling those workbench slices inline.
- Main-workbench bootstrap/bindings slices (editor-tab activation, prompt-tab actions, chat-tab open helpers, chat-history bootstrap update hook) are now routed through `RendererWorkbenchHost` instead of being assembled directly from editor feature actions inside bootstrap install/context.
- Browser-controller shell callbacks now activate/render the browser workbench view through `RendererWorkbenchHost`, rather than mutating editor state directly from the app shell.
- Paired browser/local chat launch routing now lives under the workbench region seam: `installRendererFeatureBindings(...)` consumes pairing actions from `RendererWorkbenchHost`, and the focused pairing helpers moved to `src/renderer/workbench/pairing.ts` instead of hanging off the browser module path.
- Bootstrap/bindings assembly keeps narrowing by region slices: sidebar, browser, remote-files, bottom-panel, and workbench slices enter `createRendererBindingsAssemblyContext(...)` / `createRendererBootstrapAssemblyContext(...)` through explicit groups instead of an ever-growing flat bag.
