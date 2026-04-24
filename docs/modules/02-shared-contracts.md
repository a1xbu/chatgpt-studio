# Module: shared contracts

## Files

- `src/shared/contracts.ts`

## Purpose

This file defines the common data shapes that move across the main process, preload bridge, renderer, and persistence layers.

## Why it matters

If a field is captured in the browser layer and later shown in the UI, the contract usually begins here.

## Main types

### `ChatPageContext`

Represents the current live page identity.

Fields:

- `currentProjectId`
- `currentProjectName`
- `currentChatId`
- `currentChatName`
- `detectedAt`
- `pageUrl`
- `projectUrl`
- `chatUrl`

Used by:

- injected script output
- main-process registry state
- renderer state snapshot

### `DebugLogEntry`

Normalized debug log record.

Fields:

- `id`
- `level`
- `message`
- `details`
- `source`
- `timestamp`

Sources are intentionally limited to:

- `injected-script`
- `guest-preload`
- `webview`

### `ProjectBinding`

Persistent app-level binding between a ChatGPT project and a local folder.

Fields:

- `projectId`
- `projectName`
- `folderPath`
- `projectUrl`
- `createdAt`
- `updatedAt`

Stored in:

- app `state.json`

### `ProjectChatRecord`

Sidebar/list-level representation of a known chat.

Fields:

- `chatId`
- `chatName`
- `projectId`
- `projectName`
- `chatUrl`
- `updatedAt`

Used in:

- sidebar tree
- SQLite `chats` table

### `ChatHistoryMessageRecord`

Normalized message record for local chat history.

Fields:

- `messageId`
- `role`
- `text`
- `createdAt`
- `updatedAt`
- `contentType`
- `reasoning`

Notable detail:

`reasoning` is optional structured data used for captured reasoning recap blocks.

### `ChatHistoryRecord`

Top-level local history payload.

Fields:

- `projectId`
- `projectName`
- `chatId`
- `chatName`
- `messageCount`
- `messages`
- `searchText`
- `updatedAt`
- `capturedAt`
- `isPartial?`

`isPartial` is important for live stream capture where the app may only have an incomplete view until a full snapshot arrives.

### `SidebarProject`

Renderer-focused project model.

Fields:

- project identity
- folder path
- project URL
- status (`temporary` or `persistent`)
- list of chats
- `lastSeenAt`

### `AppStateSnapshot`

Main renderer state payload sent from the main process.

Fields:

- `browserUrl`
- `lastContext`
- `temporaryProjects`
- `persistentProjects`

## Change guidance

When adding a new cross-layer field:

1. add it here
2. update normalization in the main process
3. update persistence if needed
4. update renderer types/usages

Do not add renderer-only view state here unless it truly belongs in shared contracts.
