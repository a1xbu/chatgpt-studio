# Module: files, project bundles, drag-and-drop, and remote files

## Files

- `src/main/project-bundle.ts`
- `src/main/project-archive.ts`
- `src/main/project-meta-db.ts`
- `src/main/project-registry.ts`
- `src/main/main.ts`
- `src/preload/app-preload.ts`
- `src/renderer/index.html`
- `src/renderer/app/create-renderer-app.ts`
- `src/renderer/sidebar/feature.ts`
- `src/renderer/remote-files/runtime.ts`
- `src/renderer/remote-files/shell-runtime.ts`
- `src/renderer/browser/feature.ts`
- `src/renderer/styles.css`
- `src/shared/contracts.ts`

## Purpose

Document the newer desktop workflow around four connected features:

- `File view` as the local project tree
- `Project bundle` generation and persistence
- native drag-and-drop into ChatGPT
- the resizable `Remote files` panel and apply flows

## File view

The `File view` tab is the local filesystem browser for the currently connected project.

Behavior:

- the project title keeps its original casing
- the header exposes `Open project folder`, `Refresh`, and `Create bundle` actions on the right
- the `Project bundle` card lives above the file-tree divider
- the bundle card is draggable when a bundle exists
- expanding or collapsing directories preserves the current file-tree scroll position
- file-tree navigation only refreshes the file-view subtree and does not rebuild the active local chat surface

The file tree itself remains a normal local directory tree with drag handles delegated through renderer events into the main process.

## Project bundle

### Generation flow

When the user clicks `Create bundle`, the renderer calls the preload bridge, which forwards the request to the main process. `ProjectRegistry.createProjectBundle(...)` then:

1. resolves the bound project folder
2. loads `.gitignore` from the project root when present
3. always excludes `.chatgpt` regardless of `.gitignore` contents
4. walks the project tree
5. writes a ZIP archive into `<project-folder>/.chatgpt/bundles/`
6. computes a file inventory with size, mtime, and SHA-256
7. stores the new bundle metadata in `meta.db`

### Persistence

Bundle metadata is stored in:

- `project_bundle` for the latest bundle path, creation timestamp, size, and file count
- local `Files view` coloring is renderer-driven and treats recent creation cautiously: synthetic creation timestamps introduced by ZIP extraction/copying are ignored so only genuinely new files are shown as new
- `project_bundle_files` for the per-file inventory

That lets the renderer show bundle metadata immediately after app restart, without rescanning the project folder first.

## Native drag-and-drop

The app supports native file drag-and-drop for:

- regular files from `File view`
- the generated `Project bundle` ZIP

Implementation notes:

- the renderer only marks the drag source and forwards the requested path
- the main process performs `event.sender.startDrag(...)`
- the drag icon is a real PNG file on disk, not a data URL

Using a real icon path mirrors the working proof-of-concept that was used to validate drag-and-drop behavior in Electron.

## Remote files

`Remote files` is the sidebar panel for assistant-produced sandbox files discovered from final assistant messages.

UI behavior:

- default height is 50% of the left pane
- the panel is vertically resizable
- rows are rendered as a tree instead of a flat list
- download status is shown as a right-side clickable icon instead of text
- ZIP files render as expandable archive nodes
- each downloaded row exposes hover-only `Apply` actions
- `Apply all` lives at the bottom of the panel and hides together with the collapsed panel body

## ZIP inspection and apply

Downloaded ZIP files are inspected without extracting them into the working tree first.

The inspection logic:

1. indexes archive entries for tree rendering
2. looks for `.chatgpt-remote/manifest.json`
3. also checks one directory level below the archive root when the archive root has at most 10 top-level directories
4. validates the manifest shape
5. checks that `project_id` matches the currently connected project

Expected manifest shape:

```json
{
  "project_id": "...",
  "summary": "optional",
  "project_root_in_archive": "optional"
}
```

If the manifest is valid for the active project, the app:

- marks `chat_files.is_project = true`
- stores summary/root metadata in `chat_files`
- automatically applies the archive into the project folder

## Apply semantics

`Apply` operates on three cases:

- a plain downloaded file
- a full ZIP archive
- an individual file entry inside a ZIP archive

`Apply all` traverses the currently visible downloaded remote-file entries and applies each one in sequence.

## Why this split exists

The project now has two different file surfaces on purpose:

- `File view` is the current local truth of the bound project directory
- `Remote files` is a staging area for artifacts produced by ChatGPT

That separation keeps inbound artifacts explicit, reviewable, and manually applicable while still supporting fast drag-and-drop into the live ChatGPT session.


## Local chat layout note

The renderer now keeps local chat messages inside a centered lane:

- top-level bubbles use a shared width cap of 90% of the available editor width
- narrow windows still retain a visible gutter instead of stretching bubbles edge to edge
- wide windows keep user and assistant messages close to the center line with only a slight horizontal offset
