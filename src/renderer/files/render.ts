import type { AppStateSnapshot } from '../../shared/contracts';
import type { ChatFileArchiveEntryRecord, ChatFileRecord } from '../../shared/contracts';
import type { LocalProjectFileEntry } from '../desktop-api';
import { renderFileViewPanel as renderFileViewPanelImpl } from '../render/workbench';
import type { FileDownloadRuntimeStatus } from '../runtime-types';
import type { SharedFileTreeActionButtonModel, SharedFileTreeRowModel } from '../tree/shared-tree';
import { renderLocalFileTreeRows as renderLocalFileTreeRowsRuntime, renderLocalFileViewPanel as renderLocalFileViewPanelRuntime } from './view-runtime';
import type { FilesSelectorDependencies } from './selectors';

export type FilesRenderDependencies = FilesSelectorDependencies & {
  fileViewPanelElement: HTMLElement | null;
  localFileLoadingKeys: ReadonlySet<string>;
  localFileErrorsByKey: ReadonlyMap<string, string>;
  projectBundleCreateInFlightIds: ReadonlySet<string>;
  projectBundleErrorsByProjectId: ReadonlyMap<string, string>;
  expandedLocalDirectoryKeys: ReadonlySet<string>;
  getLocalFileTreeKey: (projectId: string, relativePath?: string) => string;
  getLocalFileTreeDepth: (relativePath: string) => number;
  getLocalFileTreeChildren: (projectId: string, relativePath?: string) => LocalProjectFileEntry[];
  classifyActivity: (entry: LocalProjectFileEntry) => 'unchanged' | 'new' | 'modified';
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  formatFileSize: (value: number | null | undefined) => string;
  renderArchiveIcon: () => string;
  renderSpinnerIcon: () => string;
  renderOpenFolderIcon: () => string;
  renderRefreshIcon: () => string;
  renderFolderTreeIcon: (isOpen?: boolean) => string;
  renderFileTreeFileIcon: () => string;
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
  renderSharedFileTreeActionButton: (model: SharedFileTreeActionButtonModel) => string;
};

export function renderLocalFileTreeRows(
  projectId: string,
  dependencies: FilesRenderDependencies,
  relativePath = '',
): string {
  return renderLocalFileTreeRowsRuntime({
    projectId,
    relativePath,
    localFileLoadingKeys: dependencies.localFileLoadingKeys,
    localFileErrorsByKey: dependencies.localFileErrorsByKey,
    escapeHtml: dependencies.escapeHtml,
    getLocalFileTreeKey: dependencies.getLocalFileTreeKey,
    getLocalFileTreeChildren: dependencies.getLocalFileTreeChildren,
    expandedLocalDirectoryKeys: dependencies.expandedLocalDirectoryKeys,
    getLocalFileTreeDepth: dependencies.getLocalFileTreeDepth,
    classifyActivity: dependencies.classifyActivity,
    renderFolderTreeIcon: dependencies.renderFolderTreeIcon,
    renderFileTreeFileIcon: dependencies.renderFileTreeFileIcon,
    renderSharedFileTreeItem: dependencies.renderSharedFileTreeItem,
  });
}

export function renderLocalFileViewPanel(
  state: AppStateSnapshot,
  dependencies: FilesRenderDependencies,
  getActiveSidebarProject: (state: AppStateSnapshot) => ReturnType<FilesSelectorDependencies['findSidebarProject']>,
): string {
  return renderLocalFileViewPanelRuntime({
    state,
    getActiveSidebarProject,
    getLocalFileTreeKey: dependencies.getLocalFileTreeKey,
    localFileLoadingKeys: dependencies.localFileLoadingKeys,
    projectBundleCreateInFlightIds: dependencies.projectBundleCreateInFlightIds,
    projectBundleErrorsByProjectId: dependencies.projectBundleErrorsByProjectId,
    getLocalFileTreeChildren: dependencies.getLocalFileTreeChildren,
    classifyActivity: dependencies.classifyActivity,
    escapeHtml: dependencies.escapeHtml,
    formatTimestamp: dependencies.formatTimestamp,
    formatFileSize: dependencies.formatFileSize,
    renderArchiveIcon: dependencies.renderArchiveIcon,
    renderSpinnerIcon: dependencies.renderSpinnerIcon,
    renderOpenFolderIcon: dependencies.renderOpenFolderIcon,
    renderRefreshIcon: dependencies.renderRefreshIcon,
    renderFolderTreeIcon: dependencies.renderFolderTreeIcon,
    renderSharedFileTreeItem: dependencies.renderSharedFileTreeItem,
    renderSharedFileTreeActionButton: dependencies.renderSharedFileTreeActionButton,
    renderLocalFileTreeRows: (nextProjectId, nextRelativePath) => renderLocalFileTreeRows(nextProjectId, dependencies, nextRelativePath),
  });
}

export function renderFileViewPanel(
  state: AppStateSnapshot,
  fileViewPanelElement: HTMLElement | null,
  renderLocalFileViewPanelMarkup: (state: AppStateSnapshot) => string,
  preserveScroll = false,
): void {
  renderFileViewPanelImpl(
    state,
    { fileViewPanelElement },
    renderLocalFileViewPanelMarkup,
    preserveScroll,
  );
}
