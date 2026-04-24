
export type LocalFilesEventsElements = {
  fileViewPanelElement: HTMLElement | null;
};

export type LocalFilesEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  openFolder: (folderPath: string) => Promise<unknown> | void;
  refreshProjectFiles: (projectId: string) => void;
  createProjectBundle: (projectId: string) => void;
  toggleDirectory: (projectId: string, relativePath: string) => void;
  startFileDrag: (path: string) => void;
};

export function bindLocalFilesEvents(
  elements: LocalFilesEventsElements,
  helpers: LocalFilesEventsHelpers,
): void {
  elements.fileViewPanelElement?.addEventListener('click', (event) => {
    const openProjectFolderButton = helpers.findClosestHtmlElement(event.target, '[data-action="open-project-folder"]');
    if (openProjectFolderButton) {
      const folderPath = openProjectFolderButton.dataset.folderPath ?? '';
      if (folderPath) {
        void helpers.openFolder(folderPath);
      }
      return;
    }

    const refreshButton = helpers.findClosestHtmlElement(event.target, '[data-action="refresh-project-files"]');
    if (refreshButton) {
      const projectId = refreshButton.dataset.projectId ?? '';
      if (projectId) {
        helpers.refreshProjectFiles(projectId);
      }
      return;
    }

    const createBundleButton = helpers.findClosestHtmlElement(event.target, '[data-action="create-project-bundle"]');
    if (createBundleButton) {
      const projectId = createBundleButton.dataset.projectId ?? '';
      if (projectId) {
        helpers.createProjectBundle(projectId);
      }
      return;
    }

    const actionElement = helpers.findClosestHtmlElement(event.target, '[data-action="toggle-local-directory"]');
    if (!actionElement) {
      return;
    }

    const projectId = actionElement.dataset.projectId ?? '';
    const relativePath = actionElement.dataset.relativePath ?? '';
    if (projectId && relativePath) {
      helpers.toggleDirectory(projectId, relativePath);
    }
  });

  elements.fileViewPanelElement?.addEventListener('dragstart', (event) => {
    const bundleCard = helpers.findClosestHtmlElement(event.target, '.project-bundle__card--draggable');
    if (bundleCard) {
      const bundlePath = bundleCard.dataset.bundlePath ?? '';
      if (!bundlePath) {
        return;
      }

      event.preventDefault();
      helpers.startFileDrag(bundlePath);
      return;
    }

    const row = helpers.findClosestHtmlElement(event.target, '.file-tree__row--file');
    if (!row) {
      return;
    }

    const fullPath = row.dataset.fullPath ?? '';
    if (!fullPath) {
      return;
    }

    event.preventDefault();
    helpers.startFileDrag(fullPath);
  });
}
