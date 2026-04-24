# Data flows

## 1. Page context flow

Purpose: keep track of the currently opened ChatGPT project/chat.

### Steps

1. The user manually navigates inside ChatGPT.
2. `src/browser/injected-script.ts` notices URL changes through:
   - `history.pushState`
   - `history.replaceState`
   - `popstate`
   - `hashchange`
   - `load`
   - polling every 2 seconds
3. The injected script parses:
   - current page URL
   - conversation ID
   - project ID from URL patterns or known conversation mapping
   - known project/chat names captured earlier
4. The injected script emits a `PAGE_CONTEXT_MESSAGE_SOURCE` message via `window.postMessage(...)`.
5. `src/browser/guest-preload.ts` relays the payload through `ipcRenderer.send('chatgpt-page:context', ...)`.
6. `src/main/main.ts` forwards it into `ProjectRegistry.handlePageContext(...)`.
7. `ProjectRegistry` updates:
   - `lastContext`
   - temporary project state or persistent binding metadata
   - known current chat metadata
8. The main process broadcasts `app:state-changed`.
9. The renderer re-renders the sidebar/details/browser-opened selection.

## 2. Conversation snapshot capture flow

Purpose: persist a full or near-full chat history from viewed backend responses.

### Steps

1. The ChatGPT page requests `/backend-api/conversation/:conversationId`.
2. The injected script intercepts `fetch` and `XMLHttpRequest` responses.
3. It recognizes snapshot URLs with `SNAPSHOT_URL_PATTERN`.
4. It parses the JSON response.
5. It extracts:
   - project ID
   - project name if available
   - chat title
   - message list from `mapping`
   - message roles and text
   - timestamps
   - reasoning recap blocks and structured reasoning steps when present
6. It emits a normalized conversation-history payload via `window.postMessage(...)`.
7. Guest preload relays to `chatgpt-page:conversation-history`.
8. Main process calls `ProjectRegistry.handleConversationHistory(...)`.
9. `ProjectRegistry` normalizes and merges the history.
10. If the project is persistent:
    - ensure `.chatgpt/meta.db`
    - upsert chat metadata
    - upsert chat history
11. If the project is temporary:
    - keep chat/history only in memory
12. Main process emits `chat-history:updated` and `app:state-changed`.
13. Renderer refreshes any open local chat tabs for that chat.
14. Plain sidebar and `File view` navigation does not reload unrelated local chat tabs; the renderer reuses the current chat DOM until that chat history actually changes.

## 3. Project conversation list capture flow

Purpose: learn chat titles for a project even before a full chat snapshot is opened.

### Steps

1. ChatGPT requests `/backend-api/gizmos/:projectId/conversations...`.
2. The injected script detects the project-conversation-list URL.
3. It parses the response payload.
4. It remembers:
   - `conversationId -> projectId`
   - `conversationId -> chatTitle`
   - best-effort project name
5. It schedules a context re-emit.
6. Later context snapshots and history records become richer because names are already known.

## 4. Live stream capture flow

Purpose: capture partial history from live streaming responses while a conversation is being generated.

### Steps

1. The page makes a live request to `/backend-api/f/conversation...`.
2. The injected script detects the live endpoint.
3. It reads the request body to infer `conversation_id` when possible.
4. It clones the response and reads the stream as SSE-like chunks.
5. It parses chunk payloads and patch operations.
6. It incrementally reconstructs message content into a `StreamContext`.
7. It periodically emits partial history records with `isPartial: true`.
8. `ProjectRegistry.mergeChatHistories(...)` merges partial/live history with any existing snapshot history.
9. If later a full snapshot is seen, that richer snapshot becomes the stronger local record.

## 5. Project binding flow

Purpose: connect a ChatGPT project to a real local folder.

### Steps

1. User clicks `Connect Project` on a temporary project.
2. Renderer calls `window.desktopPoc.connectProject(projectId)`.
3. Preload forwards to `ipcMain.handle('project:connect', ...)`.
4. `ProjectRegistry.connectProject(...)` opens a directory picker.
5. The selected folder is validated against existing bindings.
6. The app creates or updates `.chatgpt/meta.db` in that folder.
7. Any temporary chats/history already captured for that project are flushed into the DB.
8. The binding is written into app `state.json`.
9. The project moves from temporary to persistent in the sidebar.

## 6. Sandbox file discovery and download flow

Purpose: discover sandbox file links from final assistant answers, decide whether they are already local, and optionally download them through the authenticated ChatGPT page session.

### Discovery steps

1. The injected script parses final assistant message text from a snapshot or partial/live history segment.
2. It extracts `sandbox:/mnt/data/...` links from those final answers only.
3. The page sends `register-sandbox-files` through the guest-preload app bridge.
4. Main process forwards to `ProjectRegistry.registerSandboxFiles(...)`.
5. The registry normalizes the records and checks whether each file already exists in the bound project's `.chatgpt/meta.db`.
6. `chat_files` is updated when a file is new.
7. The main process broadcasts updated app state.
8. Renderer updates the `Remote files` panel and local chat file blocks.

### Download steps

1. Renderer decides that a file should be downloaded:
   - automatically when `Download automatically` is enabled
   - or manually when the user clicks the download icon in `Remote files`
2. Renderer sends a webview command: `enqueue-file-download`.
3. Guest preload forwards the command into page world.
4. The injected script adds the file to its in-memory queue.
5. When the file reaches the front of the queue, the page script:
   - builds an authenticated request to `/backend-api/conversation/:chatId/interpreter/download?...`
   - reuses backend headers captured from recent ChatGPT backend traffic
   - resolves the temporary `download_url`
6. The injected script immediately downloads the actual file bytes from that returned URL, still in page context and still using authenticated headers.
7. The page script posts `save-downloaded-file` back to the app bridge.
8. Main process calls `ProjectRegistry.saveDownloadedSandboxFile(...)`.
9. The registry writes the bytes into `<project-folder>/.chatgpt/files/...` and updates the `chat_files` row with `download_url` and local `download` path.
10. Main process broadcasts updated state.
11. Renderer refreshes both:
   - the `Remote files` panel
   - file blocks attached to local chat messages

### Queue and cancellation behavior

- only one sandbox file downloads at a time in page context
- after each file, the next one waits for a randomized 10-20 second delay
- queued files expose `waiting` status
- the active or queued file can be cancelled from the renderer
- download status updates flow from page world to renderer through `chatgpt-file:status`

## 7. Local chat tab flow

Purpose: open previously captured chat history without relying on the live website.

### Steps

1. User selects a chat in a persistent project.
2. Renderer creates or activates a chat editor tab.
3. Renderer calls `window.desktopPoc.getChatHistory(projectId, chatId)`.
4. Main process asks `ProjectRegistry.getChatHistory(...)`.
5. The registry loads the record from the project's `.chatgpt/meta.db`.
6. Renderer renders:
   - metadata header
   - message timeline
   - Markdown rendering
   - structured reasoning blocks when available
   - attached sandbox-file blocks for messages that reference files

## 8. Debug log flow

Purpose: expose observability across page, preload, and webview layers.

### Sources

- injected script -> `source: 'injected-script'`
- guest preload -> `source: 'guest-preload'`
- renderer-side webview events -> `source: 'webview'`

### Steps

1. A source emits a debug payload.
2. Main process normalizes it into `DebugLogEntry`.
3. Main process stores it in an in-memory ring-like list capped by `MAX_DEBUG_LOGS`.
4. Main process emits `debug:entry` to the renderer.
5. Renderer filters, truncates, copies, and renders the visible subset.

## 9. Terminal flow

Purpose: provide a shell rooted in the current project folder.

### Steps

1. User clicks the terminal button.
2. Renderer asks main process to start a terminal with current xterm size and current project folder.
3. `TerminalManager` spawns a PTY using `node-pty`.
4. Main process streams PTY output to renderer using `terminal:data` events.
5. Renderer appends output into its session buffer and into the visible xterm instance.
6. User keystrokes are sent back with `terminal:write`.
7. Resize events are propagated with `terminal:resize`.
8. PTY exit triggers `terminal:exit`, and renderer marks the session as done.
