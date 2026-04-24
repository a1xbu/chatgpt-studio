# Module: main process

## Files

- `src/main/main.ts`

## Purpose

This is the Electron main-process entrypoint.
It creates the window, registers IPC handlers, wires the terminal manager, and forwards browser-layer events into domain logic.

## Responsibilities

- create the main `BrowserWindow`
- initialize `ProjectRegistry`
- register IPC handlers for renderer requests
- receive page/preload events from the embedded ChatGPT webview
- keep a rolling debug log buffer
- forward terminal output/exit events to the renderer

## Startup sequence

### `bootstrap()`

Order:

1. `registerIpc()`
2. `ProjectRegistry.create(...)`
3. `createMainWindow()`
4. `broadcastState()`

This means renderer subscriptions can immediately receive a coherent first state snapshot.

## Window setup

`createMainWindow()` configures:

- preload: `dist/preload/app-preload.js`
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: false`
- `webviewTag: true`

The renderer window itself is privileged only through the preload bridge.

## IPC surface

### Read/state IPC

- `app:get-state`
- `debug:get-entries`
- `chat-history:get`
- `terminal:get-state`

### Mutating/action IPC

- `debug:clear`
- `project:connect`
- `project:remove`
- `app:open-folder`
- `terminal:start`
- `terminal:write`
- `terminal:resize`
- `terminal:close`

### Browser-origin event IPC

These are event-style channels sent by the guest preload:

- `chatgpt-page:context`
- `chatgpt-page:conversation-history`
- `chatgpt-page:debug`

## Debug log handling

The main process owns the canonical in-memory debug log buffer.

Key behaviors:

- payloads are normalized through `normalizeDebugLogEntry(...)`
- entries get unique IDs
- logs are capped by `MAX_DEBUG_LOGS`
- new entries are streamed to the renderer via `debug:entry`

This makes the renderer simpler because it does not need to merge logs from multiple sources itself.

## Terminal integration

`TerminalManager` is created once at module scope.

Callbacks:

- `onData` -> `mainWindow.webContents.send('terminal:data', ...)`
- `onExit` -> `mainWindow.webContents.send('terminal:exit', ...)`

This keeps PTY lifecycle in the main process, where it belongs.

## Relationship with `ProjectRegistry`

`main.ts` intentionally does not hold business logic for projects/chats.
Instead it delegates to `ProjectRegistry` for:

- page context handling
- conversation history handling
- binding projects
- removing bindings
- loading local chat history
- producing renderer state snapshots

That separation is one of the cleaner parts of the architecture.

## Extension guidance

When adding a new backend capability for the UI:

1. add an IPC handler here
2. delegate domain work to a dedicated module when possible
3. expose the method in `src/preload/app-preload.ts`
4. call it from the relevant renderer shell/feature module, usually `src/renderer/app/create-renderer-app.ts` or a feature root

Avoid turning `main.ts` into a second domain layer.
