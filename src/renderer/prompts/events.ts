export type PromptSidebarElements = {
  promptViewPanelElement: HTMLElement | null;
  promptEditorViewElement: HTMLElement | null;
};

export type PromptEditorLike = {
  isEditing: boolean;
  draftContent: string;
  content: string;
};

export type PromptEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  openCreatePromptDialog: () => void;
  openPromptsFolder: () => void;
  setActivePromptMenu: (promptId: string, openedByButton: boolean) => void;
  openPromptTab: (promptId: string) => Promise<void>;
  showPromptError: (message: string) => void;
  findPromptEditorTab: (promptId: string) => PromptEditorLike | null;
  getCachedPromptContent: (promptId: string) => string | undefined;
  enterPromptEditMode: (promptId: string) => void;
  savePromptTab: (promptId: string) => void;
  cancelPromptEditing: (promptId: string) => void;
};

export function bindPromptEvents(
  elements: PromptSidebarElements,
  helpers: PromptEventsHelpers,
): void {
  elements.promptViewPanelElement?.addEventListener('click', (event) => {
    const createButton = helpers.findClosestHtmlElement(event.target, '[data-action="create-prompt"]');
    if (createButton) {
      helpers.openCreatePromptDialog();
      return;
    }

    const openFolderButton = helpers.findClosestHtmlElement(event.target, '[data-action="open-prompts-folder"]');
    if (openFolderButton) {
      helpers.openPromptsFolder();
      return;
    }

    const toggleMenuButton = helpers.findClosestHtmlElement(event.target, '[data-action="toggle-prompt-menu"]');
    if (toggleMenuButton) {
      const promptId = toggleMenuButton.dataset.promptId ?? '';
      if (!promptId) {
        return;
      }

      helpers.setActivePromptMenu(promptId, true);
    }
  });

  elements.promptViewPanelElement?.addEventListener('dblclick', (event) => {
    const row = helpers.findClosestHtmlElement(event.target, '[data-dblclick-action="open-prompt"]');
    if (!row || helpers.findClosestHtmlElement(event.target, '[data-action="toggle-prompt-menu"]')) {
      return;
    }

    const promptId = row.dataset.promptId ?? '';
    if (!promptId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void helpers.openPromptTab(promptId).catch((error: unknown) => {
      helpers.showPromptError(error instanceof Error ? error.message : String(error));
    });
  });

  elements.promptViewPanelElement?.addEventListener('dragstart', (event) => {
    const row = helpers.findClosestHtmlElement(event.target, '.prompt-tree__row');
    if (!row) {
      return;
    }

    const promptId = row.dataset.promptId ?? '';
    const dragEvent = event as DragEvent;
    if (!promptId || !dragEvent.dataTransfer) {
      return;
    }

    const openTab = helpers.findPromptEditorTab(promptId);
    const cachedContent = openTab?.isEditing
      ? openTab.draftContent
      : (openTab?.content || helpers.getCachedPromptContent(promptId) || '');
    dragEvent.dataTransfer.effectAllowed = 'copy';
    dragEvent.dataTransfer.setData('text/plain', cachedContent);
    dragEvent.dataTransfer.setData('text/markdown', cachedContent);
  });

  elements.promptViewPanelElement?.addEventListener('contextmenu', (event) => {
    const row = helpers.findClosestHtmlElement(event.target, '[data-context-menu-action="open-prompt-menu"]');
    if (!row) {
      return;
    }

    const promptId = row.dataset.promptId ?? '';
    if (!promptId) {
      return;
    }

    event.preventDefault();
    helpers.setActivePromptMenu(promptId, false);
  });

  elements.promptEditorViewElement?.addEventListener('click', (event) => {
    const editButton = helpers.findClosestHtmlElement(event.target, '[data-action="edit-prompt"]');
    if (editButton) {
      const promptId = editButton.dataset.promptId ?? '';
      if (promptId) {
        helpers.enterPromptEditMode(promptId);
      }
      return;
    }

    const saveButton = helpers.findClosestHtmlElement(event.target, '[data-action="save-prompt"]');
    if (saveButton) {
      const promptId = saveButton.dataset.promptId ?? '';
      if (promptId) {
        helpers.savePromptTab(promptId);
      }
      return;
    }

    const cancelButton = helpers.findClosestHtmlElement(event.target, '[data-action="cancel-prompt-edit"]');
    if (cancelButton) {
      const promptId = cancelButton.dataset.promptId ?? '';
      if (promptId) {
        helpers.cancelPromptEditing(promptId);
      }
    }
  });
}
