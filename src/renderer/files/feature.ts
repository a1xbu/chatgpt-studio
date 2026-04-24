import type {
  AppStateSnapshot,
  ChatFileArchiveEntryRecord,
  SidebarProject,
} from '../../shared/contracts';
import type { LocalProjectFileEntry } from '../desktop-api';
import {
  ensureLocalFileTreeForState,
  loadLocalFileTree,
  refreshLocalProjectTree,
  syncProjectFileSignatures,
  type FilesActionDependencies,
  type FilesEnsureLocalFileTreeDependencies,
  type FilesLoadLocalFileTreeDependencies,
} from './actions';
import {
  renderFileViewPanel,
  renderLocalFileTreeRows,
  renderLocalFileViewPanel,
  type FilesRenderDependencies,
} from './render';
import {
  getActiveSidebarProject,
  type FilesSelectorDependencies,
} from './selectors';

export type FilesFeature = {
  selectors: {
    getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
  };
  actions: {
    syncProjectFileSignatures: (state: AppStateSnapshot) => void;
    loadLocalFileTree: (projectId: string, relativePath?: string) => Promise<void>;
    ensureLocalFileTreeForState: (state: AppStateSnapshot) => void;
    refreshLocalProjectTree: (projectId: string) => void;
  };
  render: {
    localFileTreeRows: (projectId: string, relativePath?: string) => string;
    localFileViewPanel: (state: AppStateSnapshot) => string;
    fileViewPanel: (state: AppStateSnapshot, preserveScroll?: boolean) => void;
  };
};

export type FilesFeatureOptions = FilesSelectorDependencies & {
  getCurrentState: () => AppStateSnapshot | null;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  projectFileSignatures: Map<string, string>;
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  localFileErrorsByKey: Map<string, string>;
  localFileLoadingKeys: Set<string>;
  archiveEntriesByFileKey: Map<string, ChatFileArchiveEntryRecord[]>;
  archiveEntryErrorsByFileKey: Map<string, string>;
  archiveEntryLoadingKeys: Set<string>;
  projectBundleCreateInFlightIds: Set<string>;
  projectBundleErrorsByProjectId: Map<string, string>;
  expandedLocalDirectoryKeys: Set<string>;
  fileViewPanelElement: HTMLElement | null;
  listProjectFiles: (projectId: string, relativePath?: string) => Promise<LocalProjectFileEntry[]>;
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
  renderSharedFileTreeItem: FilesRenderDependencies['renderSharedFileTreeItem'];
  renderSharedFileTreeActionButton: FilesRenderDependencies['renderSharedFileTreeActionButton'];
};

export function createFilesFeature(options: FilesFeatureOptions): FilesFeature {
  const selectorDependencies: FilesSelectorDependencies = {
    getSelectedSidebarItem: options.getSelectedSidebarItem,
    findPersistentSidebarProject: options.findPersistentSidebarProject,
    findSidebarProject: options.findSidebarProject,
  };

  const actionDependencies: FilesActionDependencies = {
    ...selectorDependencies,
    getCurrentState: options.getCurrentState,
    getAllSidebarProjects: options.getAllSidebarProjects,
    projectFileSignatures: options.projectFileSignatures,
    localFileEntriesByKey: options.localFileEntriesByKey,
    localFileErrorsByKey: options.localFileErrorsByKey,
    localFileLoadingKeys: options.localFileLoadingKeys,
    archiveEntriesByFileKey: options.archiveEntriesByFileKey,
    archiveEntryErrorsByFileKey: options.archiveEntryErrorsByFileKey,
    archiveEntryLoadingKeys: options.archiveEntryLoadingKeys,
  };

  const renderDependencies = (): FilesRenderDependencies => ({
    ...selectorDependencies,
    fileViewPanelElement: options.fileViewPanelElement,
    localFileLoadingKeys: options.localFileLoadingKeys,
    localFileErrorsByKey: options.localFileErrorsByKey,
    projectBundleCreateInFlightIds: options.projectBundleCreateInFlightIds,
    projectBundleErrorsByProjectId: options.projectBundleErrorsByProjectId,
    expandedLocalDirectoryKeys: options.expandedLocalDirectoryKeys,
    getLocalFileTreeKey: options.getLocalFileTreeKey,
    getLocalFileTreeDepth: options.getLocalFileTreeDepth,
    getLocalFileTreeChildren: options.getLocalFileTreeChildren,
    classifyActivity: options.classifyActivity,
    escapeHtml: options.escapeHtml,
    formatTimestamp: options.formatTimestamp,
    formatFileSize: options.formatFileSize,
    renderArchiveIcon: options.renderArchiveIcon,
    renderSpinnerIcon: options.renderSpinnerIcon,
    renderOpenFolderIcon: options.renderOpenFolderIcon,
    renderRefreshIcon: options.renderRefreshIcon,
    renderFolderTreeIcon: options.renderFolderTreeIcon,
    renderFileTreeFileIcon: options.renderFileTreeFileIcon,
    renderSharedFileTreeItem: options.renderSharedFileTreeItem,
    renderSharedFileTreeActionButton: options.renderSharedFileTreeActionButton,
  });

  const feature: FilesFeature = {
    selectors: {
      getActiveSidebarProject: (state) => getActiveSidebarProject(state, selectorDependencies),
    },
    actions: {
      syncProjectFileSignatures: (state) => syncProjectFileSignatures(state, actionDependencies),
      loadLocalFileTree: (projectId, relativePath) => loadLocalFileTree(projectId, loadLocalFileTreeDependencies(), relativePath),
      ensureLocalFileTreeForState: (state) => ensureLocalFileTreeForState(state, ensureLocalFileTreeDependencies()),
      refreshLocalProjectTree: (projectId) => refreshLocalProjectTree(projectId, ensureLocalFileTreeDependencies()),
    },
    render: {
      localFileTreeRows: (projectId, relativePath) => renderLocalFileTreeRows(projectId, renderDependencies(), relativePath),
      localFileViewPanel: (state) => renderLocalFileViewPanel(
        state,
        renderDependencies(),
        feature.selectors.getActiveSidebarProject,
      ),
      fileViewPanel: (state, preserveScroll) => renderFileViewPanel(
        state,
        options.fileViewPanelElement,
        feature.render.localFileViewPanel,
        preserveScroll,
      ),
    },
  };

  const loadLocalFileTreeDependencies = (): FilesLoadLocalFileTreeDependencies => ({
    ...actionDependencies,
    renderFileViewPanel: feature.render.fileViewPanel,
    listProjectFiles: (projectId, relativePath) => options.listProjectFiles(projectId, relativePath ?? undefined),
  });

  const ensureLocalFileTreeDependencies = (): FilesEnsureLocalFileTreeDependencies => ({
    ...actionDependencies,
    loadLocalFileTree: feature.actions.loadLocalFileTree,
  });

  return feature;
}
