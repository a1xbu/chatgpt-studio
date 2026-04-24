# Module: preload bridge

## Files

- `src/preload/app-preload.ts`

## Purpose

Expose a narrow, explicit renderer API through `window.desktopPoc`.

## Responsibilities

- define renderer-callable async methods
- define renderer event subscriptions
- expose the guest preload URL used by the webview
- keep Node/Electron access out of renderer code

## Exposed API groups

### Bootstrap

- `getBootstrap()`

Returns:

- current app state snapshot
- current debug log buffer
- current terminal snapshots
- browser boot config:
  - start URL
  - persistent partition
  - guest preload URL

### Project/history actions

- `getChatHistory(projectId, chatId)`
- `connectProject(projectId)`
- `removeProject(projectId)`
- `openFolder(folderPath)`

### Debug actions

- `clearDebugLogs()`

### Terminal actions

- `startTerminal(cwd, cols, rows)`
- `writeTerminal(sessionId, data)`
- `resizeTerminal(sessionId, cols, rows)`
- `closeTerminal(sessionId?)`

### Event subscriptions

- `onStateChanged(...)`
- `onDebugEntry(...)`
- `onChatHistoryUpdated(...)`
- `onTerminalData(...)`
- `onTerminalExit(...)`

Each subscription returns an unsubscribe callback.

## Design strength

This bridge is intentionally plain.
It does not hide much behavior, which makes it easy to trace renderer/backend calls.

## Change guidance

Whenever you add a main-process feature needed by the renderer:

1. add the IPC handler in `src/main/main.ts`
2. mirror it here on `window.desktopPoc`
3. update the renderer-facing API type in `src/renderer/desktop-api.ts` and then wire the call from the relevant renderer shell/feature module
