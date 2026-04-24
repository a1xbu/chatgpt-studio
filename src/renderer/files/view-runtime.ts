import type { AppStateSnapshot, SidebarProject } from '../../shared/contracts';
import type { LocalProjectFileEntry } from '../desktop-api';
import { renderLocalFileTreeRows as renderLocalFileTreeRowsImpl } from '../tree/local-file-tree';
import { renderLocalFileViewPanelMarkup } from './panel';
import type { SharedFileTreeActionButtonModel, SharedFileTreeRowModel } from '../tree/shared-tree';

export type LocalFileActivityState = 'unchanged' | 'new' | 'modified';

export type RenderLocalFileTreeRowsOptions = {
  projectId: string;
  relativePath?: string;
  localFileLoadingKeys: ReadonlySet<string>;
  localFileErrorsByKey: ReadonlyMap<string, string>;
  escapeHtml: (value: string | null | undefined) => string;
  getLocalFileTreeKey: (projectId: string, relativePath?: string) => string;
  getLocalFileTreeChildren: (projectId: string, relativePath?: string) => LocalProjectFileEntry[];
  expandedLocalDirectoryKeys: ReadonlySet<string>;
  getLocalFileTreeDepth: (relativePath: string) => number;
  classifyActivity: (entry: LocalProjectFileEntry) => LocalFileActivityState;
  renderFolderTreeIcon: (isOpen?: boolean) => string;
  renderFileTreeFileIcon: () => string;
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
};

export function renderLocalFileTreeRows(options: RenderLocalFileTreeRowsOptions): string {
  const renderRows = (relativePath = ''): string => {
    const cacheKey = options.getLocalFileTreeKey(options.projectId, relativePath);
    if (options.localFileLoadingKeys.has(cacheKey)) {
      return '<div class="file-view-empty">Loading…</div>';
    }

    const errorMessage = options.localFileErrorsByKey.get(cacheKey);
    if (errorMessage) {
      return `<div class="file-view-empty">${options.escapeHtml(errorMessage)}</div>`;
    }

    return renderLocalFileTreeRowsImpl(
      {
        projectId: options.projectId,
        relativePath,
        entries: options.getLocalFileTreeChildren(options.projectId, relativePath),
        isExpanded: (nextRelativePath) => options.expandedLocalDirectoryKeys.has(options.getLocalFileTreeKey(options.projectId, nextRelativePath)),
        getDepth: options.getLocalFileTreeDepth,
        classifyActivity: options.classifyActivity,
        renderChildren: (nextRelativePath) => renderRows(nextRelativePath),
      },
      {
        renderFolderTreeIcon: options.renderFolderTreeIcon,
        renderFileTreeFileIcon: options.renderFileTreeFileIcon,
        renderSharedFileTreeItem: options.renderSharedFileTreeItem,
      },
    );
  };

  return renderRows(options.relativePath ?? '');
}

export type RenderLocalFileViewPanelOptions = {
  state: AppStateSnapshot;
  getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
  getLocalFileTreeKey: (projectId: string, relativePath?: string) => string;
  localFileLoadingKeys: ReadonlySet<string>;
  projectBundleCreateInFlightIds: ReadonlySet<string>;
  projectBundleErrorsByProjectId: ReadonlyMap<string, string>;
  getLocalFileTreeChildren: (projectId: string, relativePath?: string) => LocalProjectFileEntry[];
  classifyActivity: (entry: LocalProjectFileEntry) => LocalFileActivityState;
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  formatFileSize: (value: number | null | undefined) => string;
  renderArchiveIcon: () => string;
  renderSpinnerIcon: () => string;
  renderOpenFolderIcon: () => string;
  renderRefreshIcon: () => string;
  renderFolderTreeIcon: (isOpen?: boolean) => string;
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
  renderSharedFileTreeActionButton: (model: SharedFileTreeActionButtonModel) => string;
  renderLocalFileTreeRows: (projectId: string, relativePath?: string) => string;
};

export function renderLocalFileViewPanel(options: RenderLocalFileViewPanelOptions): string {
  const project = options.getActiveSidebarProject(options.state);
  const rootKey = project ? options.getLocalFileTreeKey(project.projectId, '') : '';

  return renderLocalFileViewPanelMarkup(
    {
      project,
      isRootLoading: Boolean(project && options.localFileLoadingKeys.has(rootKey)),
      isBundleCreating: Boolean(project && options.projectBundleCreateInFlightIds.has(project.projectId)),
      bundleErrorMessage: project ? (options.projectBundleErrorsByProjectId.get(project.projectId) ?? '') : '',
      rootHasRecentModified: Boolean(
        project && options.getLocalFileTreeChildren(project.projectId, '').some(
          (entry) => entry.containsRecentModifiedFiles || options.classifyActivity(entry) === 'modified',
        ),
      ),
    },
    {
      escapeHtml: options.escapeHtml,
      formatTimestamp: options.formatTimestamp,
      formatFileSize: options.formatFileSize,
      renderArchiveIcon: options.renderArchiveIcon,
      renderSpinnerIcon: options.renderSpinnerIcon,
      renderOpenFolderIcon: options.renderOpenFolderIcon,
      renderRefreshIcon: options.renderRefreshIcon,
      renderFolderTreeIcon: options.renderFolderTreeIcon,
      renderSharedFileTreeItem: options.renderSharedFileTreeItem,
      renderSharedFileTreeActionButton: options.renderSharedFileTreeActionButton,
      renderLocalFileTreeRows: options.renderLocalFileTreeRows,
    },
  );
}
