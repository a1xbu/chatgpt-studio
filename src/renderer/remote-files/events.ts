
export type RemoteFileEntryLike = {
  project: unknown;
  file: any;
};

export type RemoteFilesEventsElements = {
  newFilesPanelElement: HTMLElement | null;
};

export type RemoteFileDownloadCommand = 'enqueue-file-download' | 'enqueue-file-download-again' | 'cancel-file-download';

export type RemoteFilesEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  toggleCollapsed: () => void;
  getApplicableEntries: () => RemoteFileEntryLike[];
  render: () => void;
  applyAllFiles: (entries: RemoteFileEntryLike[]) => Promise<unknown>;
  findLatestEntryByKey: (fileKey: string) => RemoteFileEntryLike | null;
  getRootKey: (file: any) => string;
  getBranchKey: (file: any, relativePath: string) => string;
  expandedKeys: Set<string>;
  getArchiveEntriesLength: (fileKey: string) => number;
  loadArchiveEntries: (file: any) => Promise<unknown> | void;
  markWaitingDownload: (fileKey: string, file: any) => void;
  sendBrowserFileCommand: (command: RemoteFileDownloadCommand, file: any) => void;
  shouldWarnBeforeApplyingArchive: (file: any) => boolean;
  openArchiveApplyWarningDialog: (file: any, relativePath?: string | null) => void;
  runApplySandboxFile: (file: any, relativePath?: string | null) => Promise<unknown>;
  showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
  addDebugLog: (source: string, level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
  setDownloadAutomatically: (checked: boolean) => void;
  persistDownloadAutomatically: (checked: boolean) => void;
  queueAutomaticSandboxDownloads: () => void;
  getEffectiveDownloadPath: (file: any) => string | null;
  showItemInFolder: (filePath: string) => Promise<unknown> | void;
};

function getRemoteFileMenuPortal(documentLike: Document): HTMLElement | null {
  return documentLike.getElementById('remote-file-menu-portal');
}

function closeRemoteFileMenu(documentLike: Document): void {
  getRemoteFileMenuPortal(documentLike)?.remove();
}

function createMenuItem(documentLike: Document, label: string, action: string, fileKey: string): HTMLButtonElement {
  const item = documentLike.createElement('button');
  item.className = 'tree-row__menu-item';
  item.dataset.action = action;
  item.dataset.fileKey = fileKey;
  item.type = 'button';
  item.textContent = label;
  return item;
}

function toggleRemoteFileMenu(trigger: HTMLElement, fileKey: string): void {
  const documentLike = trigger.ownerDocument;
  const existingPortal = getRemoteFileMenuPortal(documentLike);
  if (existingPortal?.dataset.fileKey === fileKey) {
    existingPortal.remove();
    return;
  }

  existingPortal?.remove();

  const portal = documentLike.createElement('div');
  portal.id = 'remote-file-menu-portal';
  portal.className = 'remote-file-menu-portal';
  portal.dataset.fileKey = fileKey;

  const menu = documentLike.createElement('div');
  menu.className = 'tree-row__menu';
  menu.setAttribute('role', 'menu');
  menu.append(
    createMenuItem(documentLike, 'Show in folder', 'show-remote-file-in-folder', fileKey),
    createMenuItem(documentLike, 'Download again', 'download-new-file-again', fileKey),
  );
  portal.append(menu);
  documentLike.body.append(portal);

  const triggerRect = trigger.getBoundingClientRect();
  const windowLike = documentLike.defaultView;
  const gap = 6;
  menu.style.position = 'fixed';
  menu.style.left = `${Math.max(8, triggerRect.left - 182)}px`;
  menu.style.top = `${Math.max(8, triggerRect.top - 4)}px`;
  menu.style.right = 'auto';

  if (!windowLike) {
    return;
  }

  const menuRect = menu.getBoundingClientRect();
  if (menuRect.bottom > windowLike.innerHeight - 8) {
    menu.style.top = `${Math.max(8, windowLike.innerHeight - menuRect.height - 8)}px`;
  }
  if (menuRect.right > windowLike.innerWidth - 8) {
    menu.style.left = `${Math.max(8, windowLike.innerWidth - menuRect.width - gap - 8)}px`;
  }
}

function getDocumentLike(elements: RemoteFilesEventsElements): Document | null {
  if (elements.newFilesPanelElement) {
    return elements.newFilesPanelElement.ownerDocument;
  }

  return typeof document === 'undefined' ? null : document;
}

function handleDownloadAgain(fileKey: string, helpers: RemoteFilesEventsHelpers, documentLike: Document): void {
  const targetEntry = helpers.findLatestEntryByKey(fileKey);
  const file = targetEntry?.file ?? null;
  if (!file) {
    closeRemoteFileMenu(documentLike);
    return;
  }

  helpers.markWaitingDownload(fileKey, file);
  helpers.sendBrowserFileCommand('enqueue-file-download-again', file);
  helpers.render();
  closeRemoteFileMenu(documentLike);
}

function handleShowInFolder(fileKey: string, helpers: RemoteFilesEventsHelpers, documentLike: Document): void {
  const targetEntry = helpers.findLatestEntryByKey(fileKey);
  const file = targetEntry?.file ?? null;
  const filePath = file ? helpers.getEffectiveDownloadPath(file) : null;
  closeRemoteFileMenu(documentLike);
  if (!filePath) {
    helpers.showRemoteFilesNotice('Downloaded file path is unavailable.', 'error');
    return;
  }

  void Promise.resolve(helpers.showItemInFolder(filePath)).catch((error: unknown) => {
    helpers.showRemoteFilesNotice(error instanceof Error ? error.message : String(error), 'error');
    helpers.addDebugLog('webview', 'error', 'Failed to show a remote file in folder.', error instanceof Error ? error.message : String(error));
  });
}

export function bindRemoteFilesEvents(
  elements: RemoteFilesEventsElements,
  helpers: RemoteFilesEventsHelpers,
): void {
  elements.newFilesPanelElement?.addEventListener('click', (event) => {
    const menuButton = helpers.findClosestHtmlElement(event.target, '[data-action="toggle-remote-file-menu"]');
    if (menuButton) {
      const fileKey = menuButton.dataset.fileKey ?? '';
      if (!fileKey) {
        return;
      }

      event.preventDefault();
      toggleRemoteFileMenu(menuButton, fileKey);
      return;
    }

    const collapseButton = helpers.findClosestHtmlElement(event.target, '[data-action="toggle-new-files-collapse"]');
    if (collapseButton) {
      helpers.toggleCollapsed();
      helpers.render();
      return;
    }

    const applyAllButton = helpers.findClosestHtmlElement(event.target, '[data-action="apply-all-new-files"]');
    if (applyAllButton) {
      const latestEntries = helpers.getApplicableEntries().filter(({ file }) => !helpers.shouldWarnBeforeApplyingArchive(file));
      if (!latestEntries.length) {
        return;
      }

      void helpers.applyAllFiles(latestEntries).catch((error: unknown) => {
        helpers.showRemoteFilesNotice(error instanceof Error ? error.message : String(error), 'error');
        helpers.addDebugLog('webview', 'error', 'Failed to apply all remote files.', error instanceof Error ? error.message : String(error));
      });
      return;
    }

    const toggleRootButton = helpers.findClosestHtmlElement(event.target, '[data-action="toggle-new-file-root"]');
    if (toggleRootButton) {
      const fileKey = toggleRootButton.dataset.fileKey ?? '';
      const targetEntry = helpers.findLatestEntryByKey(fileKey);
      if (!targetEntry) {
        return;
      }

      const rootKey = helpers.getRootKey(targetEntry.file);
      if (helpers.expandedKeys.has(rootKey)) {
        helpers.expandedKeys.delete(rootKey);
      } else {
        helpers.expandedKeys.add(rootKey);
        if (helpers.getArchiveEntriesLength(fileKey) === 0 && ((targetEntry.file.archiveEntryCount as number | null | undefined) ?? 0) > 0) {
          void helpers.loadArchiveEntries(targetEntry.file);
        }
      }
      helpers.render();
      return;
    }

    const toggleDirectoryButton = helpers.findClosestHtmlElement(event.target, '[data-action="toggle-new-file-archive-directory"]');
    if (toggleDirectoryButton) {
      const fileKey = toggleDirectoryButton.dataset.fileKey ?? '';
      const relativePath = toggleDirectoryButton.dataset.relativePath ?? '';
      const targetEntry = helpers.findLatestEntryByKey(fileKey);
      if (!targetEntry || !relativePath) {
        return;
      }

      const branchKey = helpers.getBranchKey(targetEntry.file, relativePath);
      if (helpers.expandedKeys.has(branchKey)) {
        helpers.expandedKeys.delete(branchKey);
      } else {
        helpers.expandedKeys.add(branchKey);
      }
      helpers.render();
      return;
    }

    const downloadButton = helpers.findClosestHtmlElement(event.target, '[data-action="download-new-file"]');
    if (downloadButton) {
      const fileKey = downloadButton.dataset.fileKey ?? '';
      const targetEntry = helpers.findLatestEntryByKey(fileKey);
      const file = targetEntry?.file ?? null;
      if (!file) {
        return;
      }

      helpers.markWaitingDownload(fileKey, file);
      helpers.sendBrowserFileCommand('enqueue-file-download', file);
      helpers.render();
      return;
    }

    const applyButton = helpers.findClosestHtmlElement(event.target, '[data-action="apply-new-file"]');
    if (applyButton) {
      const fileKey = applyButton.dataset.fileKey ?? '';
      const targetEntry = helpers.findLatestEntryByKey(fileKey);
      const file = targetEntry?.file ?? null;
      if (!file) {
        return;
      }

      if (helpers.shouldWarnBeforeApplyingArchive(file)) {
        helpers.openArchiveApplyWarningDialog(file);
        return;
      }

      void helpers.runApplySandboxFile(file).catch((error: unknown) => {
        helpers.showRemoteFilesNotice(error instanceof Error ? error.message : String(error), 'error');
        helpers.addDebugLog('webview', 'error', 'Failed to apply a new file.', error instanceof Error ? error.message : String(error));
      });
      return;
    }

    const applyEntryButton = helpers.findClosestHtmlElement(event.target, '[data-action="apply-new-file-entry"]');
    if (applyEntryButton) {
      const fileKey = applyEntryButton.dataset.fileKey ?? '';
      const relativePath = applyEntryButton.dataset.relativePath ?? '';
      const targetEntry = helpers.findLatestEntryByKey(fileKey);
      const file = targetEntry?.file ?? null;
      if (!file || !relativePath) {
        return;
      }

      if (helpers.shouldWarnBeforeApplyingArchive(file)) {
        helpers.openArchiveApplyWarningDialog(file, relativePath);
        return;
      }

      void helpers.runApplySandboxFile(file, relativePath).catch((error: unknown) => {
        helpers.showRemoteFilesNotice(error instanceof Error ? error.message : String(error), 'error');
        helpers.addDebugLog('webview', 'error', `Failed to apply archive entry ${relativePath}.`, error instanceof Error ? error.message : String(error));
      });
    }
  });

  elements.newFilesPanelElement?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== 'download-automatically-toggle') {
      return;
    }

    helpers.setDownloadAutomatically(target.checked);
    helpers.persistDownloadAutomatically(target.checked);
    if (target.checked) {
      helpers.queueAutomaticSandboxDownloads();
    }
    helpers.render();
  });

  const documentLike = getDocumentLike(elements);
  if (!documentLike) {
    return;
  }

  documentLike.addEventListener('click', (event) => {
    const actionElement = helpers.findClosestHtmlElement(event.target, '[data-action]');
    const action = actionElement?.dataset.action ?? '';
    if (action === 'download-new-file-again') {
      event.preventDefault();
      handleDownloadAgain(actionElement?.dataset.fileKey ?? '', helpers, documentLike);
      return;
    }

    if (action === 'show-remote-file-in-folder') {
      event.preventDefault();
      handleShowInFolder(actionElement?.dataset.fileKey ?? '', helpers, documentLike);
      return;
    }

    if (action === 'toggle-remote-file-menu') {
      return;
    }

    const target = event.target;
    if (getRemoteFileMenuPortal(documentLike) && !(target instanceof Element && target.closest('#remote-file-menu-portal'))) {
      closeRemoteFileMenu(documentLike);
    }
  });

  documentLike.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeRemoteFileMenu(documentLike);
    }
  });
}
