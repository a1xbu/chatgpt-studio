# Module: terminal manager

## Files

- `src/main/terminal-manager.ts`

## Purpose

Own shell session lifecycle for the embedded terminal feature.

## Responsibilities

- choose an appropriate shell for the current OS
- validate requested working directories
- spawn PTY sessions with `node-pty`
- stream output back to the renderer
- accept input and resize events from the renderer
- clean up sessions on exit or app shutdown

## Shell resolution

### Windows

Priority:

1. `pwsh.exe`
2. `powershell.exe`
3. `cmd.exe` / `ComSpec`

### Non-Windows

Priority:

1. `$SHELL -i`
2. `bash -i`
3. `sh -i`

## Session model

Each active session stores:

- `sessionId`
- `cwd`
- `shell`
- underlying `node-pty` process

## Main methods

### `getSnapshots()`

Returns lightweight session metadata for renderer bootstrap.

### `open(request)`

Creates a PTY session.

Normalizations applied:

- `cwd` must exist and be a directory
- minimum size for `cols` and `rows`
- `TERM=xterm-256color`

### `write(sessionId, data)`

Passes keystrokes or pasted input to the PTY.

### `resize(sessionId, cols, rows)`

Propagates terminal dimension changes.

### `close(sessionId?)`

- with no ID: close all sessions
- with ID: kill only that session

## Integration points

- created once in `src/main/main.ts`
- renderer uses xterm to display data
- preload bridge exposes start/write/resize/close methods

## Design note

The main process deliberately keeps terminal ownership.
The renderer only holds presentation state and buffered output copies.
That is the correct privilege split for Electron.
