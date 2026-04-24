# Module: injected page script

## Files

- `src/browser/injected-script.ts`

## Purpose

This is the most important runtime observer in the repository.
It runs inside the ChatGPT page context and extracts everything the desktop app knows about:

- current project/chat identity
- project names
- chat names
- conversation history snapshots
- project conversation lists
- live streamed conversation updates
- structured reasoning blocks
- sandbox file discovery from final assistant answers
- authenticated sandbox file downloads

## Why it is complex

It has to infer stable local data from unstable web app internals.
That means it mixes:

- URL parsing
- response-body parsing
- heuristics for project naming
- fetch/XHR interception
- SSE-like stream parsing
- message normalization

## Output channels

The script emits several `window.postMessage(...)` event families:

- page context
- conversation history
- debug logs
- page->app bridge requests
- file-status updates

It never writes to disk and never talks to Electron directly.

## Main internal caches

### `knownChatNames`
Tracks best-known chat title per conversation.

### `knownProjectNames`
Tracks best-known project name per project.

### `knownConversationProjectIds`
Tracks `conversationId -> projectId`.

### `pendingConversationProjectIds`
Temporary hints captured from request headers or request bodies before a full snapshot confirms the mapping.


## Backend header capture for downloads

The sandbox-file pipeline needs authenticated backend requests, but those credentials should stay in memory rather than local storage.

### What is captured

The script keeps a small in-memory header cache built from recent ChatGPT backend traffic, including:

- `authorization` when available
- selected `oai-*` transport headers
- bootstrap fallback values such as build number, client version, device ID, and language

Relevant helpers:

- `captureBackendHeadersFromRequest(...)`
- `captureBootstrapAuthorization()`
- `captureBootstrapBackendHeaders()`
- `buildBackendRequestHeaders(...)`

### Why it is done this way

The actual file resolution and file download requests are sent from page context so they can reuse the same authenticated session assumptions as ChatGPT itself. The cache is kept only in memory and is rebuilt from normal page traffic.

## Sandbox file discovery

### Scope of extraction

Sandbox file links are intentionally extracted only from the final assistant answer in a reasoning chain, not from:

- user messages
- tool messages
- intermediate assistant tool/code fragments
- reasoning-only recap blocks

Relevant helpers:

- `extractSandboxPaths(...)`
- `registerSandboxFilesFromText(...)`
- `isAssistantFinalMessageCandidate(...)`

### Discovery output

When new files are found, the page sends `register-sandbox-files` through the app bridge. The response tells the page which files already existed and whether any already had a local download path.

## Sandbox download queue

The page keeps its own in-memory queue so downloads happen inside the authenticated ChatGPT session.

Key behaviors:

- only one active file at a time
- queued files are marked `waiting`
- after each file, the next one waits for a randomized 10-20 second delay
- queued or active files can be cancelled
- a popup and `file-status` events expose progress to the renderer

Relevant helpers:

- `enqueueSandboxFileDownload(...)`
- `cancelSandboxFileDownload(...)`
- `processSandboxDownloadQueue()`
- `markSandboxDownloadStatus(...)`
- `updateDownloadPopup(...)`

## Download resolution and file fetch flow

For each queued file, the page does two network steps.

### 1. Resolve the authenticated download URL

`resolveSandboxDownload(...)` calls:

- `/backend-api/conversation/:chatId/interpreter/download?message_id=...&sandbox_path=...`

using the in-memory backend headers prepared by `buildBackendRequestHeaders(...)`. The JSON response is expected to contain `download_url` or an equivalent `url` field.

### 2. Download the actual file bytes

`fetchSandboxDownload(...)` then downloads the returned URL, streams the bytes, emits progress, and keeps the bytes in memory until the transfer finishes.

### 3. Hand the bytes to the desktop app

After the file is fully downloaded, the page sends `save-downloaded-file` through the app bridge. The main process writes the bytes into the bound project's `.chatgpt/files/` directory and persists the metadata into `chat_files`.

## Context extraction

### URL parsing helpers

Important helpers:

- `detectConversationIdFromUrl(...)`
- `extractProjectContextFromUrl(...)`
- `deriveProjectUrl(...)`
- `readPageContext()`

The script recognizes multiple project URL patterns, including grouped `g-p-...` style IDs.

## History extraction from snapshots

### Snapshot endpoint detection

`SNAPSHOT_URL_PATTERN` matches `/backend-api/conversation/:id`.

### `extractConversationHistoryRecord(...)`

This is the core snapshot parser.

It:

- walks `snapshot.mapping`
- extracts message text from multiple content layouts
- normalizes author roles
- converts timestamps to ISO format
- skips empty/unusable entries
- extracts `thoughts` content as structured reasoning steps
- attaches reasoning steps to `reasoning_recap` blocks
- sorts messages chronologically
- builds denormalized `searchText`

## Project name capture strategy

Project names are learned from several possible places.

### 1. Response payload matching

`extractProjectNameFromPayload(...)` tries to match project IDs inside payload records and read fields such as:

- `project_name`
- `gizmo_name`
- `name`
- `display.name`

### 2. Network title capture

The script also inspects request bodies for page/title payloads and parses titles like:

- `Some Project - ChatGPT`
- `Some Project - Some Conversation`

Functions involved:

- `applyNetworkTitlePayload(...)`
- `parseProjectNameFromNetworkTitle(...)`
- `captureTitlePayloadFromBody(...)`

This is a heuristic layer, but valuable because not all responses carry explicit project names.

## Chat name capture strategy

Chat names come from:

- project conversation list responses
- full conversation snapshots

The script rejects low-value titles like:

- `New chat`
- `Untitled chat`
- generated placeholder/decorated variants

## Live stream capture

### Endpoint detection

`LIVE_STREAM_URL_PATTERN` matches `/backend-api/f/conversation...`.

### Strategy

The script clones the response, reads the stream, and reconstructs messages progressively.

Key pieces:

- `createStreamContext(...)`
- `processLiveStreamChunk(...)`
- `processSseEventBlock(...)`
- `processStreamPayload(...)`
- `processStreamPatchOperation(...)`
- `emitStreamHistory(...)`

### Important detail

Live stream histories are emitted with `isPartial: true`.
That allows the main process to merge them with later, fuller snapshots.

## Text and reasoning extraction

### Message text

`extractMessageText(...)` collects fragments from several possible content shapes, including nested `text`, `content`, and `parts` arrays.

### Reasoning steps

`extractReasoningSteps(...)` reads `content.thoughts` and converts them into:

- `summary`
- `content`
- `chunks`

Later, recap-style messages may reference these steps.

## Navigation/context emission

The script emits context when:

- history state changes
- page load/hash/popstate changes happen
- a delayed scheduled emit runs
- a periodic timer fires every 2 seconds

This redundancy improves resilience when ChatGPT uses client-side routing.

## Fragility notes

This file is the most likely to break if ChatGPT changes:

- backend endpoint shapes
- message JSON structure
- stream patch format
- URL naming/layout conventions
- project/title payload conventions

Any breakage here often looks like:

- missing project names
- missing chat titles
- no local history being captured
- no context updates in the sidebar

## Safe editing advice

When changing this file:

1. preserve existing debug logs or add more
2. prefer additive heuristics over replacing working ones
3. keep emitted payloads normalized and conservative
4. avoid assuming a single response shape when multiple are already supported
