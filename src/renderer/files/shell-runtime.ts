import type { AppStateSnapshot, SidebarProject } from '../../shared/contracts';
import type {
  RendererAppStoreSlice,
  RendererFilesStoreSlice,
  RendererRemoteFilesStoreSlice,
  RendererWorkspaceStoreSlice,
} from '../app/store';
import type { DesktopPocApi, LocalProjectFileEntry } from '../desktop-api';
import type { RendererSidebarHost } from '../sidebar/host';
import type { FilesFeatureOptions } from './feature';

export type CreateRendererFilesFeatureOptionsArgs = {
  appState: RendererAppStoreSlice;
  workspaceState: RendererWorkspaceStoreSlice;
  filesState: RendererFilesStoreSlice;
  remoteFilesState: RendererRemoteFilesStoreSlice;
  desktopApi: Pick<DesktopPocApi, 'listProjectFiles'>;
  elements: {
    fileViewPanelElement: HTMLElement | null;
  };
  sidebarHost: Pick<
    RendererSidebarHost,
    | 'renderSharedFileTreeItem'
    | 'renderSharedFileTreeActionButton'
    | 'getLocalFileTreeKey'
    | 'getLocalFileTreeDepth'
    | 'getLocalFileTreeChildren'
  >;
  queries: {
    getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
    findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  };
  formatters: {
    escapeHtml: FilesFeatureOptions['escapeHtml'];
    formatTimestamp: FilesFeatureOptions['formatTimestamp'];
    formatFileSize: FilesFeatureOptions['formatFileSize'];
  };
  icons: Pick<
    FilesFeatureOptions,
    | 'renderArchiveIcon'
    | 'renderSpinnerIcon'
    | 'renderOpenFolderIcon'
    | 'renderRefreshIcon'
    | 'renderFolderTreeIcon'
    | 'renderFileTreeFileIcon'
  >;
  classifyActivity: (entry: LocalProjectFileEntry) => 'unchanged' | 'new' | 'modified';
};

export function createRendererFilesFeatureOptions(
  args: CreateRendererFilesFeatureOptionsArgs,
): FilesFeatureOptions {
  return {
    getCurrentState: () => args.appState.currentState,
    getSelectedSidebarItem: () => args.workspaceState.selectedSidebarItem,
    getAllSidebarProjects: args.queries.getAllSidebarProjects,
    findPersistentSidebarProject: args.queries.findPersistentSidebarProject,
    findSidebarProject: args.queries.findSidebarProject,
    projectFileSignatures: args.filesState.projectFileSignatures,
    localFileEntriesByKey: args.filesState.localFileEntriesByKey,
    localFileErrorsByKey: args.filesState.localFileErrorsByKey,
    localFileLoadingKeys: args.filesState.localFileLoadingKeys,
    archiveEntriesByFileKey: args.remoteFilesState.archiveEntriesByFileKey,
    archiveEntryErrorsByFileKey: args.remoteFilesState.archiveEntryErrorsByFileKey,
    archiveEntryLoadingKeys: args.remoteFilesState.archiveEntryLoadingKeys,
    projectBundleCreateInFlightIds: args.filesState.projectBundleCreateInFlightIds,
    projectBundleErrorsByProjectId: args.filesState.projectBundleErrorsByProjectId,
    expandedLocalDirectoryKeys: args.filesState.expandedLocalDirectoryKeys,
    fileViewPanelElement: args.elements.fileViewPanelElement,
    listProjectFiles: (projectId, relativePath) => args.desktopApi.listProjectFiles(projectId, relativePath),
    getLocalFileTreeKey: args.sidebarHost.getLocalFileTreeKey,
    getLocalFileTreeDepth: args.sidebarHost.getLocalFileTreeDepth,
    getLocalFileTreeChildren: args.sidebarHost.getLocalFileTreeChildren,
    classifyActivity: args.classifyActivity,
    escapeHtml: args.formatters.escapeHtml,
    formatTimestamp: args.formatters.formatTimestamp,
    formatFileSize: args.formatters.formatFileSize,
    renderArchiveIcon: args.icons.renderArchiveIcon,
    renderSpinnerIcon: args.icons.renderSpinnerIcon,
    renderOpenFolderIcon: args.icons.renderOpenFolderIcon,
    renderRefreshIcon: args.icons.renderRefreshIcon,
    renderFolderTreeIcon: args.icons.renderFolderTreeIcon,
    renderFileTreeFileIcon: args.icons.renderFileTreeFileIcon,
    renderSharedFileTreeItem: args.sidebarHost.renderSharedFileTreeItem,
    renderSharedFileTreeActionButton: args.sidebarHost.renderSharedFileTreeActionButton,
  };
}
