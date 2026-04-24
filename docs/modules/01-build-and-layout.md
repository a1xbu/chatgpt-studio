# Module: build and project layout

## Files

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `scripts/build.mjs`

## Purpose

This layer defines how source files are compiled and packaged into runnable Electron output.

## What it owns

- TypeScript compilation
- `dist/` cleanup and regeneration
- injected script inlining into the generated guest preload
- copying static renderer assets and browser vendor assets

## Build pipeline summary

### TypeScript

`tsconfig.json` compiles `src/**/*.ts` and `src/**/*.d.ts` into `dist/` using:

- target: `ES2022`
- module: `CommonJS`
- rootDir: `src`
- outDir: `dist`

### Custom post-processing

`scripts/build.mjs` does more than just compile.

After TypeScript compilation it:

1. reads generated `dist/browser/injected-script.js`
2. reads generated `dist/browser/guest-preload.js`
3. replaces the placeholder string in `guest-preload.js` with the full injected-script source literal
4. copies renderer HTML/CSS
5. copies vendor assets for:
   - xterm
   - xterm fit addon
   - markdown-it


## Injected-script build detail

The page script is authored in `src/browser/injected-script.ts`, but the runtime entry point is the built guest preload.

The build sequence is intentionally two-stage:

1. `tsc` emits `dist/browser/injected-script.js` and `dist/browser/guest-preload.js`
2. `scripts/build.mjs` reads that generated injected-script JavaScript as plain text
3. it replaces `return INJECTED_SOURCE_PLACEHOLDER;` inside the generated guest preload with a string literal containing the full page-script source
4. at runtime, `guest-preload.js` calls `webFrame.executeJavaScript(...)` with that inlined source

This means any manual TypeScript compilation done for debugging still needs the post-build inlining step before the preload matches production behavior.

## Why the injected script is inlined

The page-world script is executed through `webFrame.executeJavaScript(...)` from the webview preload.
Inlining it into the built preload means:

- there is a single deployable preload file chain
- the guest preload does not need to fetch external source at runtime
- early installation is simpler

## Main scripts from `package.json`

- `npm run build` — authoritative full build: compile TypeScript, inline the generated injected script into the generated guest preload, and copy renderer/vendor assets
- `npm run build:ts` — compile TypeScript only; useful for inspecting intermediate generated JS, but not the full post-processed runnable build
- `npm run start:electron` — launch Electron using the existing `dist/` output
- `npm run start` — run the full build, then launch Electron
- `npm run dev` — alias to `start`
- `npm run typecheck` — run TypeScript without emitting files

## Dependency notes

### Runtime dependencies

- `sql.js` — SQLite-like local DB in the main process
- `node-pty` — embedded terminal backend
- `xterm` + `@xterm/addon-fit` — terminal UI
- `markdown-it` — chat message rendering

### Development dependencies

- `electron`
- `typescript`
- `@types/node`

## Important invariant

`dist/` is generated output. Do not hand-edit generated files unless debugging the build itself.
All real changes should be made in `src/` or `scripts/`.
