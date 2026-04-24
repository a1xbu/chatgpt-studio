
export type RemoteFileEntryLike = {
  project: unknown;
  file: any;
};

export type RemoteFilesEventsElements = {
  newFilesPanelElement: HTMLElement | null;
};

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
  sendBrowserFileCommand: (command: 'enqueue-file-download' | 'cancel-file-download', file: any) => void;
  shouldWarnBeforeApplyingArchive: (file: any) => boolean;
  openArchiveApplyWarningDialog: (file: any, relativePath?: string | null) => void;
  runApplySandboxFile: (file: any, relativePath?: string | null) => Promise<unknown>;
  showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
  addDebugLog: (source: string, level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
  setDownloadAutomatically: (checked: boolean) => void;
  persistDownloadAutomatically: (checked: boolean) => void;
  queueAutomaticSandboxDownloads: () => void;
};

export function bindRemoteFilesEvents(
  elements: RemoteFilesEventsElements,
  helpers: RemoteFilesEventsHelpers,
): void {
  elements.newFilesPanelElement?.addEventListener('click', (event) => {
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
}
