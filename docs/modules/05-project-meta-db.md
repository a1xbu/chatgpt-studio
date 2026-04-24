# Module: project metadata database

## Files

- `src/main/project-meta-db.ts`
- `src/types/sqljs.d.ts` (supporting type declarations)

## Purpose

Provide per-project local persistence in SQLite format using `sql.js`.

Database location:

- `<project-folder>/.chatgpt/meta.db`

## Why this DB exists

The app-level JSON store is only for bindings.
This DB stores the richer local metadata that belongs to a specific bound project.

## Tables

### `project_meta`

Stores one row per bound project.

Columns:

- `project_id` (PK)
- `project_name`
- `folder_path`
- `source_url`
- `project_url`
- `updated_at`

### `chats`

Stores known chat metadata for the project.

Columns:

- `chat_id` (PK)
- `chat_name`
- `project_id`
- `project_name`
- `source_url`
- `chat_url`
- `updated_at`

Index:

- `idx_chats_project_id`

### `chat_history`

Stores one row per chat history.

Columns:

- `chat_id` (PK)
- `project_id`
- `project_name`
- `chat_name`
- `message_count`
- `search_text`
- `history_json`
- `updated_at`
- `captured_at`

Index:

- `idx_chat_history_project_id`

### `chat_files`

Stores discovered sandbox files per chat message.

Columns:

- `chat_id`
- `message_id`
- `sandbox_path`
- `project_id`
- `project_name`
- `download_url`
- `download`
- `file_name`
- `discovered_at`
- `updated_at`
- `is_project`
- `project_summary`
- `project_root_in_archive`
- `applied_at`
- `apply_error`
- `archive_entry_count`

Primary key:

- `(chat_id, message_id, sandbox_path)`

Indexes:

- `idx_chat_files_project_id`
- `idx_chat_files_chat_id`

`download` stores the local saved path when the file has already been written into `.chatgpt/files/`. `download_url` stores the resolved remote URL that was used for that download when available.

`is_project` is set when a downloaded ZIP contains a valid `.chatgpt-remote/manifest.json` for the currently connected project.


### `chat_file_archive_entries`

Stores an index of ZIP contents for downloaded remote files so the renderer can show them as an expandable tree without extracting the archive into the working directory.

Columns:

- `chat_id`
- `message_id`
- `sandbox_path`
- `relative_path`
- `entry_kind` (`file` or `directory`)
- `size_bytes`
- `modified_at`

### `project_bundle`

Stores the latest generated project bundle per connected project.

Columns:

- `project_id`
- `bundle_path`
- `created_at`
- `size_bytes`
- `file_count`

### `project_bundle_files`

Stores the file inventory for the current project bundle.

Columns:

- `project_id`
- `relative_path`
- `modified_at`
- `size_bytes`
- `sha256`

## Schema strategy

`initializeSchema(...)` both creates tables and backfills newer columns through `ensureColumn(...)`.
This is a lightweight migration strategy suitable for a PoC.

## Important functions

### `resolveProjectMetaDbPath(folderPath)`

Returns the canonical path to the project's DB file.

### `ensureProjectMetaDb(identity)`

Ensures the DB exists and upserts `project_meta`.
Also backfills project names into existing chat rows.

### `upsertProjectChat(folderPath, chat)`

Upserts sidebar/list-level chat metadata.

### `listProjectChats(folderPath)`

Reads chats sorted by `updated_at DESC, chat_name ASC`.
Used to rebuild renderer caches at startup or after binding changes.

### `upsertChatFile(folderPath, file)`

Upserts one discovered or downloaded sandbox file row.

Important behavior:

- discovery metadata can arrive before any local download exists
- later saves preserve the first discovery timestamp while updating `download_url`, `download`, and `updated_at`

### `getChatFile(...)` / `listChatFiles(...)` / `listProjectFiles(...)`

Read back sandbox-file rows either for:

- a single `(chatId, messageId, sandboxPath)` identity
- all files in one chat
- all files in one project

When a local `download` path exists, the reader also derives `sizeBytes` from the file currently on disk.

### `upsertChatHistory(folderPath, history)`

Persists a normalized `ChatHistoryRecord` into `chat_history`.

Notable design choice:

- messages are serialized as JSON into `history_json`
- `search_text` is stored denormalized for future local search use

### `getChatHistory(folderPath, chatId)`

Loads a persisted chat history and normalizes message payloads back into typed records.

## Normalization behavior

The module is intentionally tolerant when reading persisted JSON.
It:

- cleans text
- validates timestamps
- filters bad messages
- restores reasoning steps if present
- gracefully returns `null` for malformed records

That tolerance is important because stored JSON payloads may evolve over time.

## Why `sql.js`

Benefits in this PoC context:

- simple file-based persistence
- no native DB server needed
- portable DB file inside the project folder

Trade-offs:

- database writes rewrite exported binary data
- not ideal for very large datasets
- migration tooling is manual

For the current PoC scale, this is reasonable.
