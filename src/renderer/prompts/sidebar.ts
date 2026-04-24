import {
  renderPromptRow as renderPromptRowImpl,
  type PromptTreePromptRecord,
  type PromptTreeRenderHelpers,
} from './prompt-tree';

export type PromptSidebarViewModel = {
  promptDirectoryPath: string;
  prompts: readonly PromptTreePromptRecord[];
  activePromptMenuId: string | null;
  activeEditorTabId: string;
};

export type PromptSidebarRenderHelpers = PromptTreeRenderHelpers & {
  getPromptEditorTabId: (promptId: string) => string;
  renderOpenFolderIcon: () => string;
  escapeHtml: (value: string | null | undefined) => string;
};

export function renderPromptViewPanelMarkup(
  viewModel: PromptSidebarViewModel,
  helpers: PromptSidebarRenderHelpers,
): string {
  const createTitle = 'New prompt';
  const openFolderTitle = 'Open prompts folder';
  return `
    <div class="file-view-panel__header">
      <div class="file-view-panel__title-row">
        <div class="file-view-panel__title">Prompts</div>
        <div class="file-view-panel__toolbar">
          <button
            class="secondary-button secondary-button--small secondary-button--icon secondary-button--icon-square"
            data-action="open-prompts-folder"
            type="button"
            title="${helpers.escapeHtml(openFolderTitle)}"
            aria-label="${helpers.escapeHtml(openFolderTitle)}"
          >
            ${helpers.renderOpenFolderIcon()}
          </button>
          <button
            class="secondary-button secondary-button--small"
            data-action="create-prompt"
            type="button"
            title="${helpers.escapeHtml(createTitle)}"
            aria-label="${helpers.escapeHtml(createTitle)}"
          >
            New prompt
          </button>
        </div>
      </div>
      <div class="file-view-panel__path" title="${helpers.escapeHtml(viewModel.promptDirectoryPath)}">${helpers.escapeHtml(viewModel.promptDirectoryPath || 'Loading prompts directory…')}</div>
    </div>
    <div class="file-view-panel__tree">
      ${viewModel.prompts.length
        ? viewModel.prompts.map((prompt) => renderPromptRowImpl(
            prompt,
            {
              isMenuOpen: viewModel.activePromptMenuId === prompt.id,
              isActive: viewModel.activeEditorTabId === helpers.getPromptEditorTabId(prompt.id),
            },
            helpers,
          )).join('')
        : '<div class="file-view-empty">No prompts yet. Create your first prompt.</div>'}
    </div>
  `;
}
