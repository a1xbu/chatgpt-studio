# Module: app store and project registry

## Files

- `src/main/app-store.ts`
- `src/main/project-registry.ts`

## Purpose

These files together own the application's project-level state model.

- `app-store.ts` persists the app-wide JSON binding file
- `project-registry.ts` is the in-memory domain controller for projects, chats, and local history routing

## `app-store.ts`

### Purpose

Persist the small global JSON file under Electron's user data directory.

### Stored shape

```ts
interface PersistedAppStore {
  version: 1;
  bindings: ProjectBinding[];
}
```

### Key behaviors

- tolerant loading: malformed or partial data falls back to defaults
- normalization of project bindings on load
- creation of parent directories on save

### What belongs here

- durable app-level binding metadata only

### What does not belong here

- chat histories
- large project datasets
- renderer-only preferences

## `project-registry.ts`

## Core responsibility

This is the app's **state brain**.

It decides:

- what the current project/chat is
- whether a project is temporary or persistent
- where incoming history should be stored
- where discovered sandbox files should be stored
- how multiple history captures are merged
- what state snapshot the renderer should receive

## Main state fields

### `bindingsByProjectId`

Persistent `projectId -> ProjectBinding` map loaded from `state.json`.

### `persistentChatsByProjectId`

Renderer-friendly in-memory cache of known persisted chats per project.

### `temporaryProject`

At most one temporary project is kept at a time.
This mirrors the current live context-driven PoC behavior rather than trying to maintain a large temporary project index.

### `lastContext`

Most recently observed live page context.
Used to enrich bindings and fallback values.

## Main entrypoints

### `ProjectRegistry.create(storePath)`

- loads bindings from JSON store
- creates registry
- reloads persisted chats from each bound project DB

### `getStateSnapshot()`

Builds the renderer-facing `AppStateSnapshot`.

Notable detail:

- temporary project is surfaced separately from persistent projects
- persistent projects are sorted by project name
- chats are sorted by `updatedAt`

### `handlePageContext(rawContext)`

Consumes page context emitted from the ChatGPT page.

If the project is already bound:

- updates binding metadata
- ensures project meta DB exists
- upserts current chat when available
- clears temporary state

If the project is not bound:

- creates/updates temporary project state
- records the current chat in memory

### `handleConversationHistory(rawHistory)`

Consumes normalized chat history payloads from the page.

If the project is bound:

- ensures DB exists
- loads any existing persisted history
- merges incoming and persisted histories
- upserts chat metadata
- upserts history
- updates cached persistent chat list

If the project is temporary:

- merges into temporary in-memory history
- updates temporary chat list

### `registerSandboxFile(...)` / `registerSandboxFiles(...)`

These methods accept page-discovered sandbox file metadata, normalize it, deduplicate it, and either:

- persist it into the bound project's `chat_files` table
- or keep it in the temporary in-memory project state until the project is connected

The return value tells the page whether the file already existed and whether it already had a local download path.

### `saveDownloadedSandboxFile(...)`

This method is called after the injected page script has already downloaded the file bytes.

It:

1. validates the payload
2. requires that the project is already bound to a local folder
3. writes the bytes into `<project-folder>/.chatgpt/files/...`
4. upserts the matching `chat_files` row with `download_url`, local path, and size-derived metadata
5. updates the persistent in-memory cache used by the renderer

### `connectProject(projectId, parentWindow)`

Promotes a temporary project into a persistent bound project.

Sequence:

1. validate project ID
2. open folder picker
3. reject folder conflicts with other bindings
4. create/update binding
5. ensure `.chatgpt/meta.db`
6. persist any temporary chats/histories into DB
7. write updated binding store
8. move project to persistent cache

### `getChatHistory(projectId, chatId)`

Only returns local history for persistent projects.
Temporary in-memory history is not exposed as a local-history tab source.

### `removeProject(projectId)`

Removes the binding and persistent chat cache entry.

Important detail:

- it does **not** delete files from disk
- if the removed project is still the current live page context, it is recreated as a temporary project in memory

## Merge strategy for histories

### `mergeChatHistories(base, incoming)`

This is one of the most important functions in the repo.

It:

- deduplicates messages using a synthetic identity
- prefers richer/non-unknown roles
- prefers longer text payloads
- prefers later timestamps
- prefers reasoning payloads with actual steps
- rebuilds `searchText`
- carries forward `isPartial` when either side is partial

This merge logic is what makes live partial capture and later full snapshot capture coexist reasonably well.

## Naming strategy

The registry uses fallback helpers:

- `resolveProjectName(...)`
- `resolveChatName(...)`

Today they are deliberately simple and mainly prevent null labels in the UI.
A richer naming policy would likely still belong here.

## Design strengths

- clear ownership of temporary vs persistent state
- normalization is centralized
- persistence routing is centralized
- renderer gets a clean snapshot instead of many tiny domain rules

## Design limitations

- only one temporary project is tracked at a time
- file is large and mixes many concerns
- change impact can be wide because the registry sits at the center of many flows
