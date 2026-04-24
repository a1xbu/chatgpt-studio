# Module: browser injection bridge

## Files

- `src/browser/guest-preload.ts`

## Purpose

This file is the bridge between:

- the embedded ChatGPT page world
- Electron IPC

It is the smallest but most security-sensitive bridge in the browser observation path.

## Responsibilities

- verify the current host is supported
- execute the inlined injected page script as early as possible
- relay structured page messages to the main process
- handle page->app request/response bridging for sandbox file registration and file saving
- forward app->page commands for sandbox download queue control
- forward page->renderer file-status events through `sendToHost(...)`
- emit guest-preload debug messages when installation fails or is skipped

## Core constants

- `PAGE_CONTEXT_MESSAGE_SOURCE`
- `PAGE_DEBUG_MESSAGE_SOURCE`
- `PAGE_HISTORY_MESSAGE_SOURCE`
- `PAGE_APP_REQUEST_MESSAGE_SOURCE`
- `PAGE_APP_RESPONSE_MESSAGE_SOURCE`
- `PAGE_APP_COMMAND_MESSAGE_SOURCE`
- `PAGE_FILE_STATUS_MESSAGE_SOURCE`
- `INJECTED_SOURCE_PLACEHOLDER`

The placeholder is replaced during build with the actual injected page script source.

## Install flow

### `installInjectedScript()`

Behavior:

1. prevent duplicate installation with `installStarted`
2. ensure current host looks like ChatGPT
3. ensure the build replaced the placeholder
4. execute the injected source through `webFrame.executeJavaScript(..., true)`
5. report success/failure as debug entries

The function is called both:

- on `process.once('loaded', ...)`
- immediately at module load

This increases the chance that the page script is installed very early.

## Message relay behavior

`window.addEventListener('message', ...)` listens only for messages from the same window and known source tags.

Routing:

- page context -> `chatgpt-page:context`
- conversation history -> `chatgpt-page:conversation-history`
- page bridge request -> `ipcRenderer.invoke(...)` to file-registration / file-save handlers
- app command -> `window.postMessage(...)` back into page world
- file status -> `ipcRenderer.sendToHost('chatgpt-file:status', ...)` for the renderer webview host
- debug -> `chatgpt-page:debug`


## Sandbox file bridge behavior

The guest preload now acts as a small RPC bridge for the file pipeline.

### Page -> app requests

Supported actions:

- `register-sandbox-file`
- `register-sandbox-files`
- `save-downloaded-file`

The preload receives these requests from the page, calls the corresponding Electron IPC handler, then posts a success/error response back into page world with the original `requestId`.

### App -> page commands

The main/renderer side can send `chatgpt-file:command` into the guest preload. The preload forwards that payload into page world so the injected script can:

- enqueue a download
- cancel a queued or active download

### Page -> renderer status updates

The injected script posts file-status messages while a file is waiting, resolving, downloading, saving, finishing, cancelling, or failing. The guest preload forwards those status packets to the embedding renderer with `sendToHost(...)`.

## Why this layer exists

The injected script runs in page world and does not have Electron access.
The guest preload can see both worlds, so it acts as the narrow relay point.

## Failure modes to inspect

If no project/chat data reaches the app, inspect this file for:

- unsupported hostname match
- placeholder not replaced during build
- `executeJavaScript` failure
- missing/changed page message source strings
