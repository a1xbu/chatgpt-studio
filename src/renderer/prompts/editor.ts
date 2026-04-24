export type PromptEditorTabState = {
  id: string;
  promptId: string;
  title: string;
  promptPath: string;
  content: string;
  draftContent: string;
  status: 'loading' | 'ready' | 'error';
  message: string | null;
  isDirty: boolean;
  isEditing: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  saveMessage: string | null;
};

export type PromptEditorHelpers = {
  createEmptyState: (message: string) => HTMLElement;
  escapeHtml: (value: string | null | undefined) => string;
  renderMarkdown: (markdown: string) => string;
  isActiveTab: () => boolean;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  refreshStatus: () => void;
};

export function getPromptEditorStatusText(tab: PromptEditorTabState): string {
  if (tab.status === 'loading') {
    return 'Loading…';
  }

  if (tab.status === 'error') {
    return tab.message ?? 'Error';
  }

  if (tab.saveState === 'saving') {
    return 'Saving…';
  }

  if (tab.saveState === 'error') {
    return tab.saveMessage ?? 'Save failed';
  }

  if (tab.isEditing && tab.isDirty) {
    return 'Unsaved changes';
  }

  return tab.saveMessage ?? (tab.isEditing ? 'Editing' : 'Preview');
}

export function createPromptEditorContent(
  tab: PromptEditorTabState,
  helpers: PromptEditorHelpers,
): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'prompt-editor-shell';

  if (tab.status === 'loading') {
    shell.append(helpers.createEmptyState('Loading prompt…'));
    return shell;
  }

  if (tab.status === 'error') {
    shell.append(helpers.createEmptyState(tab.message ?? 'Failed to load prompt.'));
    return shell;
  }

  const header = document.createElement('div');
  header.className = 'prompt-editor-header';
  header.innerHTML = `
    <div class="prompt-editor-header__top">
      <div class="prompt-editor-header__left">
        ${tab.isEditing
          ? `<button class="secondary-button secondary-button--small" data-action="save-prompt" data-prompt-id="${helpers.escapeHtml(tab.promptId)}" type="button" ${tab.isDirty ? '' : 'disabled'}>Save</button>
             <button class="secondary-button secondary-button--small" data-action="cancel-prompt-edit" data-prompt-id="${helpers.escapeHtml(tab.promptId)}" type="button">Cancel</button>`
          : `<button class="secondary-button secondary-button--small" data-action="edit-prompt" data-prompt-id="${helpers.escapeHtml(tab.promptId)}" type="button">Edit</button>`}
      </div>
      <h2 class="prompt-editor-header__title">${helpers.escapeHtml(tab.title)}</h2>
      <div class="prompt-editor-header__status" data-role="prompt-save-status"></div>
    </div>
    <div class="prompt-editor-header__path" title="${helpers.escapeHtml(tab.promptPath)}">${helpers.escapeHtml(tab.promptPath)}</div>
  `;
  shell.append(header);

  const body = document.createElement('div');
  body.className = tab.isEditing ? 'prompt-editor-body prompt-editor-body--edit' : 'prompt-editor-body prompt-editor-body--preview';

  if (tab.isEditing) {
    const textarea = document.createElement('textarea');
    textarea.className = 'prompt-editor__textarea';
    textarea.value = tab.draftContent;
    textarea.spellcheck = false;
    textarea.placeholder = '# Prompt title\n\nWrite your reusable prompt here...';
    textarea.addEventListener('input', () => {
      tab.draftContent = textarea.value;
      tab.isDirty = tab.draftContent !== tab.content;
      tab.saveState = 'idle';
      tab.saveMessage = null;
      const saveButton = shell.querySelector('[data-action="save-prompt"]');
      if (saveButton instanceof HTMLButtonElement) {
        saveButton.disabled = !tab.isDirty;
      }
      helpers.refreshStatus();
    });
    textarea.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void helpers.onSave();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        helpers.onCancel();
      }
    });
    body.append(textarea);

    requestAnimationFrame(() => {
      if (helpers.isActiveTab()) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
      helpers.refreshStatus();
    });
  } else {
    const preview = document.createElement('div');
    preview.className = 'prompt-preview chat-message__markdown';
    preview.innerHTML = helpers.renderMarkdown(tab.content || '');
    body.append(preview);
    requestAnimationFrame(() => {
      helpers.refreshStatus();
    });
  }

  shell.append(body);
  return shell;
}
