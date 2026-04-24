export type ProjectBundleFileRecord = {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  sha256: string;
};

export type ProjectBundleRecord = {
  projectId: string;
  bundlePath: string;
  createdAt: string;
  sizeBytes: number | null;
  fileCount: number;
  files: ProjectBundleFileRecord[];
};

export type FilePanelProjectRecord = {
  projectId: string;
  projectName: string;
  folderPath: string | null;
  bundle: ProjectBundleRecord | null;
};

export type FilePanelViewModel = {
  project: FilePanelProjectRecord | null;
  isRootLoading: boolean;
  isBundleCreating: boolean;
  bundleErrorMessage: string;
  rootHasRecentModified: boolean;
};

export type FilePanelHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  formatFileSize: (value: number | null | undefined) => string;
  renderArchiveIcon: () => string;
  renderSpinnerIcon: () => string;
  renderOpenFolderIcon: () => string;
  renderRefreshIcon: () => string;
  renderFolderTreeIcon: (isOpen?: boolean) => string;
  renderSharedFileTreeItem: (model: any) => string;
  renderSharedFileTreeActionButton: (model: any) => string;
  renderLocalFileTreeRows: (projectId: string, relativePath?: string) => string;
};

function renderProjectBundleCard(
  project: FilePanelProjectRecord,
  viewModel: FilePanelViewModel,
  helpers: FilePanelHelpers,
): string {
  const bundle = project.bundle;
  const iconMarkup = helpers.renderArchiveIcon();
  const spinnerMarkup = viewModel.isBundleCreating ? `<span class="project-bundle__spinner" aria-hidden="true">${helpers.renderSpinnerIcon()}</span>` : '';

  if (!bundle) {
    return `
      <div class="project-bundle">
        <div class="project-bundle__heading">Project bundle</div>
        <div class="project-bundle__card ${viewModel.isBundleCreating ? 'project-bundle__card--pending' : ''}">
          <div class="project-bundle__row">
            <span class="project-bundle__icon">${iconMarkup}</span>
            <div class="project-bundle__content">
              <div class="project-bundle__title">Project bundle</div>
              <div class="project-bundle__meta">${viewModel.isBundleCreating ? 'Creating…' : 'No bundle yet'}</div>
              <div class="project-bundle__meta">${viewModel.isBundleCreating ? 'Scanning files and writing ZIP archive…' : 'Click Create bundle to build a ZIP archive for drag-and-drop.'}</div>
            </div>
            ${spinnerMarkup}
          </div>
          ${viewModel.bundleErrorMessage ? `<div class="project-bundle__error">${helpers.escapeHtml(viewModel.bundleErrorMessage)}</div>` : ''}
        </div>
      </div>
    `;
  }

  const cardClasses = [
    'project-bundle__card',
    'project-bundle__card--draggable',
    viewModel.isBundleCreating ? 'project-bundle__card--pending' : '',
  ].filter(Boolean).join(' ');
  const titleText = `${bundle.bundlePath}\nDrag into ChatGPT to upload`;

  return `
    <div class="project-bundle">
      <div class="project-bundle__heading">Project bundle</div>
      <div
        class="${cardClasses}"
        data-bundle-path="${helpers.escapeHtml(bundle.bundlePath)}"
        draggable="true"
        title="${helpers.escapeHtml(titleText)}"
      >
        <div class="project-bundle__row">
          <span class="project-bundle__icon">${iconMarkup}</span>
          <div class="project-bundle__content">
            <div class="project-bundle__title">Project bundle</div>
            <div class="project-bundle__meta">${viewModel.isBundleCreating ? 'Creating…' : `Created ${helpers.escapeHtml(helpers.formatTimestamp(bundle.createdAt))}`}</div>
            <div class="project-bundle__meta">${helpers.escapeHtml(helpers.formatFileSize(bundle.sizeBytes))} • ${String(bundle.fileCount)} file${bundle.fileCount === 1 ? '' : 's'}</div>
          </div>
          ${spinnerMarkup}
        </div>
        ${viewModel.bundleErrorMessage ? `<div class="project-bundle__error">${helpers.escapeHtml(viewModel.bundleErrorMessage)}</div>` : ''}
      </div>
    </div>
  `;
}

export function renderLocalFileViewPanelMarkup(
  viewModel: FilePanelViewModel,
  helpers: FilePanelHelpers,
): string {
  const project = viewModel.project;
  if (!project) {
    return '<div class="file-view-empty">Select a project to inspect local files.</div>';
  }

  if (!project.folderPath) {
    return '<div class="file-view-empty">Connect this project to a local folder first.</div>';
  }

  const createButtonLabel = viewModel.isBundleCreating ? 'Creating…' : 'Create bundle';
  const refreshTitle = viewModel.isRootLoading ? 'Refreshing files…' : 'Refresh files';
  const openFolderTitle = 'Open project folder';
  return `
    <div class="file-view-panel__header">
      <div class="file-view-panel__title-row">
        <div class="file-view-panel__title">${helpers.escapeHtml(project.projectName)}</div>
        <div class="file-view-panel__toolbar">
          <button
            class="secondary-button secondary-button--small secondary-button--icon secondary-button--icon-square"
            data-action="open-project-folder"
            data-folder-path="${helpers.escapeHtml(project.folderPath)}"
            type="button"
            title="${helpers.escapeHtml(openFolderTitle)}"
            aria-label="${helpers.escapeHtml(openFolderTitle)}"
          >
            ${helpers.renderOpenFolderIcon()}
          </button>
          <button
            class="secondary-button secondary-button--small secondary-button--icon secondary-button--icon-square secondary-button--icon-refresh"
            data-action="refresh-project-files"
            data-project-id="${helpers.escapeHtml(project.projectId)}"
            type="button"
            title="${helpers.escapeHtml(refreshTitle)}"
            aria-label="${helpers.escapeHtml(refreshTitle)}"
            ${viewModel.isRootLoading ? 'disabled' : ''}
          >
            ${helpers.renderRefreshIcon()}
          </button>
          <button
            class="secondary-button secondary-button--small"
            data-action="create-project-bundle"
            data-project-id="${helpers.escapeHtml(project.projectId)}"
            type="button"
            ${viewModel.isBundleCreating ? 'disabled' : ''}
          >
            ${helpers.escapeHtml(createButtonLabel)}
          </button>
        </div>
      </div>
      <div class="file-view-panel__path" title="${helpers.escapeHtml(project.folderPath)}">${helpers.escapeHtml(project.folderPath)}</div>
      ${renderProjectBundleCard(project, viewModel, helpers)}
    </div>
    <div class="file-view-panel__tree ${viewModel.isRootLoading ? 'file-view-panel__tree--loading' : ''}">
      ${helpers.renderSharedFileTreeItem({
        kind: 'directory',
        name: project.projectName,
        depth: 0,
        iconMarkup: helpers.renderFolderTreeIcon(true),
        title: project.folderPath,
        toggleMode: 'placeholder',
        rowClassNames: [
          'file-tree__row--directory',
          'file-tree__row--root',
          viewModel.rootHasRecentModified ? 'file-tree__row--recent-directory' : '',
        ],
        rowAttributes: {
          'data-project-id': project.projectId,
          'data-relative-path': '',
        },
        actionMarkup: [
          helpers.renderSharedFileTreeActionButton({
            action: 'open-project-folder',
            title: 'Open project folder',
            iconMarkup: helpers.renderOpenFolderIcon(),
            rowKind: 'directory',
            attributes: {
              'data-folder-path': project.folderPath,
            },
          }),
          helpers.renderSharedFileTreeActionButton({
            action: 'refresh-project-files',
            title: refreshTitle,
            iconMarkup: helpers.renderRefreshIcon(),
            rowKind: 'directory',
            classNames: ['file-tree__action-button--refresh'],
            attributes: {
              'data-project-id': project.projectId,
            },
            disabled: viewModel.isRootLoading,
          }),
        ].join(''),
        childrenMarkup: helpers.renderLocalFileTreeRows(project.projectId, ''),
      })}
    </div>
  `;
}
