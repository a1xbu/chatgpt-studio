# electron-chatgpt-poc documentation index

This folder contains **AI-friendly technical documentation** for the `electron-chatgpt-poc` project.

## Recommended reading order

1. [`AGENT_GUIDE.md`](./AGENT_GUIDE.md) — fastest orientation for an engineer or coding agent.
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system boundaries, components, and current renderer structure.
3. [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) — current architectural verdict, debt, and next steps.
4. [`DATA_FLOWS.md`](./DATA_FLOWS.md) — end-to-end runtime flows.
5. Module docs in [`modules/`](./modules/) — subsystem-level notes.
6. [`HANDOFF_PROMPT.md`](./HANDOFF_PROMPT.md) — pasteable prompt for continuing work in a new chat.

## Core design statement

This project is a **desktop shell around manual use of ChatGPT in an embedded browser**.
It is intentionally designed so that:

- ChatGPT is opened as a normal website inside an Electron `webview`
- the user performs actions manually
- the app observes page state and network responses locally
- the app stores locally viewed project/chat metadata and captured histories
- the app does **not** automate user actions against ChatGPT

## Source of truth

When reading the codebase, prefer these directories in order:

1. `src/` — authoritative source files
2. `scripts/` — build pipeline
3. `dist/` — generated output, useful only to verify build results

Do **not** treat `dist/` as the primary implementation source.

## Main subsystems

- `src/browser` — code that runs inside the ChatGPT page environment or the webview preload layer
- `src/main` — Electron main process, persistence, IPC handlers, terminal process manager, Git inspection, archive/bundle flows
- `src/preload` — secure API bridge from Electron main process to the renderer
- `src/renderer` — desktop workbench UI, browser host, sidebar, local chat tabs, prompts, debug console, terminal UI
- `src/shared` — cross-process contracts and shared types
- `src/types` — local type declarations for third-party packages

## Important renderer docs

- [`modules/renderer-ownership.md`](./modules/renderer-ownership.md)
- [`modules/10-renderer-workbench.md`](./modules/10-renderer-workbench.md)
- [`modules/11-renderer-shell-and-styles.md`](./modules/11-renderer-shell-and-styles.md)

## Important reading for the sandbox-file pipeline

- [`modules/01-build-and-layout.md`](./modules/01-build-and-layout.md) — explains the TypeScript -> `dist/` -> guest-preload inlining pipeline
- [`modules/07-browser-injection-bridge.md`](./modules/07-browser-injection-bridge.md) — explains page/app request-response-command relays
- [`modules/08-injected-script.md`](./modules/08-injected-script.md) — explains header capture, file discovery, queueing, and authenticated downloads
- [`modules/05-project-meta-db.md`](./modules/05-project-meta-db.md) — explains `chat_files`, bundle, and archive persistence

## Docs map

- [`modules/01-build-and-layout.md`](./modules/01-build-and-layout.md)
- [`modules/02-shared-contracts.md`](./modules/02-shared-contracts.md)
- [`modules/03-main-process.md`](./modules/03-main-process.md)
- [`modules/04-app-store-and-project-registry.md`](./modules/04-app-store-and-project-registry.md)
- [`modules/05-project-meta-db.md`](./modules/05-project-meta-db.md)
- [`modules/06-terminal-manager.md`](./modules/06-terminal-manager.md)
- [`modules/07-browser-injection-bridge.md`](./modules/07-browser-injection-bridge.md)
- [`modules/08-injected-script.md`](./modules/08-injected-script.md)
- [`modules/09-preload-bridge.md`](./modules/09-preload-bridge.md)
- [`modules/10-renderer-workbench.md`](./modules/10-renderer-workbench.md)
- [`modules/11-renderer-shell-and-styles.md`](./modules/11-renderer-shell-and-styles.md)
- [`modules/12-local-types-and-generated-output.md`](./modules/12-local-types-and-generated-output.md)
- [`modules/13-files-bundles-and-remote-files.md`](./modules/13-files-bundles-and-remote-files.md)
- [`modules/renderer-ownership.md`](./modules/renderer-ownership.md)
