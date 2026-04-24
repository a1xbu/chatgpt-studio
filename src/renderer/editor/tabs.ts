export type EditorPairedSelection = {
  projectId: string;
  chatId: string;
};

export type EditorBrowserTab = {
  id: 'browser';
  kind: 'browser';
  title: string;
};

export type EditorChatTab = {
  id: string;
  kind: 'chat';
  projectId: string;
  chatId: string;
  title: string;
  history?: {
    chatName: string | null;
  } | null;
};

export type EditorPromptTab = {
  id: string;
  kind: 'prompt';
  title: string;
};

export type EditorTabRecord = EditorBrowserTab | EditorChatTab | EditorPromptTab;

export type EditorTabsViewModel = {
  editorTabs: readonly EditorTabRecord[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
  pairedSelection: EditorPairedSelection | null;
  pairedLabel: string;
};

export type EditorTabsHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  renderBrowserTabIcon: () => string;
  renderChatIcon: () => string;
  renderPromptIcon: () => string;
  renderCloseIcon: () => string;
};

export function buildEditorTabsMarkup(
  viewModel: EditorTabsViewModel,
  helpers: EditorTabsHelpers,
): string {
  const visibleTabs = viewModel.editorTabs.filter((tab) => {
    if (tab.kind !== 'chat' || !viewModel.pairedSelection) {
      return true;
    }

    return tab.projectId !== viewModel.pairedSelection.projectId || tab.chatId !== viewModel.pairedSelection.chatId;
  });

  return visibleTabs
    .map((tab) => {
      if (tab.kind === 'browser') {
        const browserIsActive = viewModel.activeEditorTabId === 'browser' && viewModel.activePairedEditorSubtab === 'browser';
        const localIsActive = viewModel.activeEditorTabId === 'browser'
          && viewModel.activePairedEditorSubtab === 'local'
          && Boolean(viewModel.pairedSelection);
        const browserTitle = viewModel.pairedSelection ? `Browser pair · ${viewModel.pairedLabel}` : tab.title;
        if (!viewModel.pairedSelection) {
          return `
            <div class="editor-tab ${browserIsActive ? 'editor-tab--active' : ''}" data-editor-tab-id="browser">
              <button class="editor-tab__button editor-tab__button--icon-only" data-editor-tab-id="browser" title="${helpers.escapeHtml(browserTitle)}" aria-label="Open Browser" type="button">
                <span class="editor-tab__icon">${helpers.renderBrowserTabIcon()}</span>
              </button>
            </div>
          `;
        }

        return `
          <div class="editor-tab editor-tab--paired ${viewModel.activeEditorTabId === 'browser' ? 'editor-tab--active' : ''}">
            <button
              class="editor-tab__pair-segment editor-tab__pair-segment--icon-only ${browserIsActive ? 'editor-tab__pair-segment--active' : ''}"
              data-action="switch-paired-tab-view"
              data-paired-view="browser"
              title="Open Browser"
              type="button"
            >
              <span class="editor-tab__icon">${helpers.renderBrowserTabIcon()}</span>
            </button>
            <button
              class="editor-tab__pair-segment ${localIsActive ? 'editor-tab__pair-segment--active' : ''}"
              data-action="switch-paired-tab-view"
              data-paired-view="local"
              title="Open local chat ${helpers.escapeHtml(viewModel.pairedLabel)}"
              type="button"
            >
              <span class="editor-tab__icon">${helpers.renderChatIcon()}</span>
              <span class="editor-tab__label">${helpers.escapeHtml(viewModel.pairedLabel)}</span>
            </button>
          </div>
        `;
      }

      if (tab.kind === 'prompt') {
        const isActive = tab.id === viewModel.activeEditorTabId;
        const label = tab.title;
        return `
          <div class="editor-tab editor-tab--prompt ${isActive ? 'editor-tab--active' : ''}" data-editor-tab-id="${helpers.escapeHtml(tab.id)}">
            <button class="editor-tab__button" data-editor-tab-id="${helpers.escapeHtml(tab.id)}" title="${helpers.escapeHtml(label)}" type="button">
              <span class="editor-tab__icon">${helpers.renderPromptIcon()}</span>
              <span class="editor-tab__label">${helpers.escapeHtml(label)}</span>
            </button>
            <button
              class="editor-tab__close"
              data-action="close-editor-tab"
              data-editor-tab-id="${helpers.escapeHtml(tab.id)}"
              title="Close ${helpers.escapeHtml(label)}"
              aria-label="Close ${helpers.escapeHtml(label)}"
              type="button"
            >
              ${helpers.renderCloseIcon()}
            </button>
          </div>
        `;
      }

      const label = tab.history?.chatName ?? tab.title;
      const isActive = tab.id === viewModel.activeEditorTabId;
      return `
        <div class="editor-tab ${isActive ? 'editor-tab--active' : ''}" data-editor-tab-id="${helpers.escapeHtml(tab.id)}">
          <button class="editor-tab__button" data-editor-tab-id="${helpers.escapeHtml(tab.id)}" title="${helpers.escapeHtml(label)}" type="button">
            <span class="editor-tab__icon">${helpers.renderChatIcon()}</span>
            <span class="editor-tab__label">${helpers.escapeHtml(label)}</span>
          </button>
          <button
            class="editor-tab__close"
            data-action="close-editor-tab"
            data-editor-tab-id="${helpers.escapeHtml(tab.id)}"
            title="Close ${helpers.escapeHtml(label)}"
            aria-label="Close ${helpers.escapeHtml(label)}"
            type="button"
          >
            ${helpers.renderCloseIcon()}
          </button>
        </div>
      `;
    })
    .join('');
}
