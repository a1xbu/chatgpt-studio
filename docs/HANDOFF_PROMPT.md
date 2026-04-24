# Handoff prompt for a new chat

Use this prompt when continuing the renderer refactor in a new chat.

```text
We are continuing work on the Electron project `electron-chatgpt-poc`.

Current state:
- `src/renderer/renderer.ts` is now a thin entrypoint.
- The main shell lives in `src/renderer/app/create-renderer-app.ts`.
- Renderer store/services/ui refs/context live under `src/renderer/app/*`.
- There is a lazy feature registry in `src/renderer/app/feature-registry.ts`.
- Region seams now exist:
  - `src/renderer/sidebar/host.ts`
  - `src/renderer/workbench/host.ts`
- Feature roots now exist:
  - `src/renderer/sidebar/feature.ts`
  - `src/renderer/files/feature.ts`
  - `src/renderer/prompts/feature.ts`
  - `src/renderer/editor/feature.ts`
  - `src/renderer/browser/feature.ts`
  - `src/renderer/bottom-panel/feature.ts`
- Pairing/browser-local chat routing moved under the workbench seam through:
  - `src/renderer/workbench/host.ts`
  - `src/renderer/workbench/pairing.ts`
- Workbench-owned bootstrap/bindings slices are now exposed from `src/renderer/workbench/host.ts` and consumed by bootstrap/bindings assembly instead of being assembled inline in `createRendererApp()`.
- Bootstrap/bindings assembly still lives in:
  - `src/renderer/bootstrap/renderer-context.ts`
  - `src/renderer/bootstrap/install.ts`
  - `src/renderer/bootstrap/composition.ts`

Important constraints:
- Do not put new logic back into `src/renderer/renderer.ts`.
- Avoid turning `createRendererApp()` into the permanent home for new feature logic.
- Prefer decomposition by ownership / region / scenario, not by `impl/events/controller` file naming.
- Do not touch `node_modules` to “fix” local environment issues.
- Keep commits in the existing `.git` from the provided archive.
- Before returning an archive, verify that the archive root folder name matches the archive name and that the latest repo contents are inside it.

Important docs to read first:
- `docs/ARCHITECTURE.md`
- `docs/modules/renderer-ownership.md`
- `docs/ARCHITECTURE_REVIEW.md`
- `docs/modules/10-renderer-workbench.md`
- `docs/AGENT_GUIDE.md`

Current architecture verdict:
- Much healthier than the original renderer monolith.
- Still transitional.
- Biggest remaining problem is `src/renderer/app/create-renderer-app.ts` plus the flat bootstrap/bindings assembly bags.
- The old `workspace` feature root is gone; sidebar/new-files/project-tree ownership now lives under `src/renderer/sidebar/{feature,shell-runtime}.ts`, while the store slice name is still transitional.
- `SidebarHost` and `WorkbenchHost` are real seams, but not yet full region owners.

What to do next:
1. Continue shrinking `createRendererApp()` by moving more region-owned bootstrap/bindings assembly behind hosts or more focused modules.
2. Continue narrowing bootstrap/bindings contexts by region slices instead of adding new flat fields.
3. Continue improving ownership boundaries around `sidebar` / `files` / `remote-files`, especially where the remaining `workspace` store slice and flat bootstrap/bindings bags still leak file/remote-file state.
4. Keep pairing/workbench logic under the workbench region, not back under browser shell glue.
5. Add or update tests for every ownership move.

When you answer, include:
- architecture reasoning
- what changed
- tests run
- commit hash(es)
- updated plan with checked items and remaining items
- final archive link
```
