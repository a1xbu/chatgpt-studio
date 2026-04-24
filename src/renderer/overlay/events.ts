
export type OverlayEventsElements = {
  overlayRootElement: HTMLElement;
  documentLike: Document;
};

export type OverlayEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  confirmPromptNameDialog: (value: string) => void;
  cancelPromptNameDialog: () => void;
  isPromptNameDialogOpen: () => boolean;
  copyRemoteManifestPrompt: (projectId: string) => Promise<unknown> | void;
  confirmArchiveApplyWarning: (fileKey: string, relativePath?: string | null) => void;
  cancelArchiveApplyWarning: () => void;
  isArchiveApplyWarningOpen: () => boolean;
  closePropertiesDialog: () => void;
  isPropertiesDialogOpen: () => boolean;
  isActiveTreeMenuOpen: () => boolean;
  closeActiveTreeMenu: () => void;
  isActivePromptMenuOpen: () => boolean;
  closeActivePromptMenu: () => void;
  openPrompt: (promptId: string) => Promise<unknown> | void;
  renamePrompt: (promptId: string) => void;
  deletePrompt: (promptId: string) => void;
};

export function bindOverlayEvents(
  elements: OverlayEventsElements,
  helpers: OverlayEventsHelpers,
): void {
  elements.overlayRootElement.addEventListener('click', (event) => {
    const actionElement = helpers.findClosestHtmlElement(event.target, '[data-action]');
    const action = actionElement?.dataset.action ?? '';

    if (action === 'confirm-prompt-name-dialog') {
      const input = elements.overlayRootElement.querySelector('[data-role="prompt-name-input"]');
      const value = input instanceof HTMLInputElement ? input.value : '';
      helpers.confirmPromptNameDialog(value);
      return;
    }

    if (action === 'cancel-prompt-name-dialog') {
      helpers.cancelPromptNameDialog();
      return;
    }

    if (action === 'copy-remote-manifest-prompt') {
      const projectId = actionElement?.dataset.projectId ?? '';
      void helpers.copyRemoteManifestPrompt(projectId);
      return;
    }

    if (action === 'confirm-archive-apply-warning') {
      const fileKey = actionElement?.dataset.fileKey ?? '';
      const relativePath = actionElement?.dataset.relativePath ?? null;
      helpers.confirmArchiveApplyWarning(fileKey, relativePath);
      return;
    }

    if (action === 'cancel-archive-apply-warning') {
      helpers.cancelArchiveApplyWarning();
      return;
    }

    if (helpers.isPromptNameDialogOpen() || helpers.isArchiveApplyWarningOpen()) {
      return;
    }

    if (action === 'close-properties-dialog' || event.target === elements.overlayRootElement.firstElementChild) {
      helpers.closePropertiesDialog();
    }
  });

  elements.overlayRootElement.addEventListener('keydown', (event) => {
    if (!helpers.isPromptNameDialogOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      helpers.cancelPromptNameDialog();
      return;
    }

    if (event.key === 'Enter') {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        event.preventDefault();
        helpers.confirmPromptNameDialog(target.value);
      }
    }
  });

  elements.documentLike.addEventListener('click', (event) => {
    const actionElement = helpers.findClosestHtmlElement(event.target, '[data-action="open-prompt"], [data-action="rename-prompt"], [data-action="delete-prompt"]');
    if (actionElement) {
      const action = actionElement.dataset.action ?? '';
      const promptId = actionElement.dataset.promptId ?? '';
      if (promptId) {
        if (action === 'open-prompt') {
          helpers.closeActivePromptMenu();
          void helpers.openPrompt(promptId);
          return;
        }
        if (action === 'rename-prompt') {
          helpers.closeActivePromptMenu();
          helpers.renamePrompt(promptId);
          return;
        }
        if (action === 'delete-prompt') {
          helpers.closeActivePromptMenu();
          helpers.deletePrompt(promptId);
          return;
        }
      }
    }

    const target = event.target;
    if (helpers.isActiveTreeMenuOpen()) {
      if (!(target instanceof Element && target.closest('[data-action="toggle-tree-menu"]'))) {
        helpers.closeActiveTreeMenu();
      }
    }

    if (helpers.isActivePromptMenuOpen()) {
      if (!(target instanceof Element && target.closest('[data-action="toggle-prompt-menu"]'))) {
        helpers.closeActivePromptMenu();
      }
    }
  });

  elements.documentLike.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (helpers.isActiveTreeMenuOpen()) {
      helpers.closeActiveTreeMenu();
    }
    if (helpers.isPropertiesDialogOpen()) {
      helpers.closePropertiesDialog();
    }
    if (helpers.isActivePromptMenuOpen()) {
      helpers.closeActivePromptMenu();
    }
  });
}
