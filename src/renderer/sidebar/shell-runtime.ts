import type {
  AppStateSnapshot,
  ChatFileRecord,
  ProjectChatRecord,
  SidebarProject,
} from '../../shared/contracts';
import type {
  RendererAppStoreSlice,
  RendererRemoteFilesStoreSlice,
  RendererWorkspaceStoreSlice,
} from '../app/store';
import type { RendererRemoteFilesRuntime } from '../remote-files/runtime';
import type { RendererSidebarHost } from './host';
import type { SidebarFeatureOptions } from './feature';

export type CreateRendererSidebarFeatureOptionsArgs = {
  appState: RendererAppStoreSlice;
  workspaceState: RendererWorkspaceStoreSlice;
  remoteFilesState: RendererRemoteFilesStoreSlice;
  storage: Storage;
  storageKeys: {
    sidebarSelection: string;
    newFilesCollapsed: string;
  };
  elements: {
    projectListElement: HTMLElement | null;
    newFilesPanelElement: HTMLElement | null;
    newFilesPanelResizerElement: HTMLElement | null;
  };
  sidebarHost: Pick<
    RendererSidebarHost,
    | 'getTreeMenuKey'
    | 'getActiveSidebarTabId'
    | 'getActiveTreeMenu'
    | 'setSelectedSidebarItem'
    | 'ensureExpandedProjects'
    | 'ensureNewFilesPanelHeight'
    | 'applySidebarDetailsState'
    | 'applySidebarTabState'
  >;
  remoteFilesRuntime: Pick<RendererRemoteFilesRuntime, 'getEffectiveDownloadPath' | 'ensureArchiveEntriesForVisibleNewFiles'>;
  queries: {
    getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
    getLatestNewFiles: (
      projects: SidebarProject[],
      selection: SidebarFeatureOptions['getSelectedSidebarItem'] extends () => infer T ? T : never,
    ) => Array<{ project: SidebarProject; file: ChatFileRecord }>;
    findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
    getChatFileKey: (file: ChatFileRecord) => string;
    getSandboxFileBaseName: (file: ChatFileRecord) => string;
  };
  formatters: {
    escapeHtml: SidebarFeatureOptions['escapeHtml'];
    formatTimestamp: SidebarFeatureOptions['formatTimestamp'];
  };
  icons: Pick<
    SidebarFeatureOptions,
    | 'renderChevronIcon'
    | 'renderProjectIcon'
    | 'renderChatIcon'
    | 'renderMoreActionsIcon'
    | 'renderOpenInBrowserIcon'
    | 'renderFolderTreeIcon'
    | 'renderFileTreeFileIcon'
    | 'renderArchiveIcon'
    | 'renderGitBranchIcon'
    | 'renderApplyIcon'
    | 'renderBusyIcon'
    | 'renderCheckIcon'
    | 'renderDownloadArrowIcon'
  >;
};

function persistSidebarSelection(
  storage: Storage,
  storageKey: string,
  selection: SidebarFeatureOptions['getSelectedSidebarItem'] extends () => infer T ? T : never,
): void {
  if (!selection) {
    storage.removeItem(storageKey);
    return;
  }

  storage.setItem(storageKey, JSON.stringify(selection));
}

export function createRendererSidebarFeatureOptions(
  args: CreateRendererSidebarFeatureOptionsArgs,
): SidebarFeatureOptions {
  return {
    getCurrentState: () => args.appState.currentState,
    getSelectedSidebarItem: () => args.workspaceState.selectedSidebarItem,
    getAllSidebarProjects: args.queries.getAllSidebarProjects,
    getLatestNewFiles: args.queries.getLatestNewFiles,
    findPersistentSidebarProject: args.queries.findPersistentSidebarProject,
    findSidebarProject: args.queries.findSidebarProject,
    findSidebarChat: args.queries.findSidebarChat,
    expandedProjectIds: args.workspaceState.expandedProjectIds,
    expandedNewFilesKeys: args.remoteFilesState.expandedNewFilesKeys,
    fileDownloadStatuses: args.remoteFilesState.fileDownloadStatuses,
    getLastNewFilesSignature: () => args.remoteFilesState.lastNewFilesSignature,
    setLastNewFilesSignature: (value) => {
      args.remoteFilesState.lastNewFilesSignature = value;
    },
    getIsNewFilesCollapsed: () => args.workspaceState.isNewFilesCollapsed,
    setIsNewFilesCollapsed: (value) => {
      args.workspaceState.isNewFilesCollapsed = value;
    },
    getRemoteFilesNotice: () => args.remoteFilesState.remoteFilesNotice,
    getDownloadAutomatically: () => args.remoteFilesState.downloadAutomatically,
    getActiveSidebarTabId: args.sidebarHost.getActiveSidebarTabId,
    getActiveTreeMenu: args.sidebarHost.getActiveTreeMenu,
    persistSidebarSelection: (selection) => {
      persistSidebarSelection(args.storage, args.storageKeys.sidebarSelection, selection);
    },
    setSelectedSidebarItem: args.sidebarHost.setSelectedSidebarItem,
    persistCollapsedState: (value) => {
      args.storage.setItem(args.storageKeys.newFilesCollapsed, String(value));
    },
    projectListElement: args.elements.projectListElement,
    newFilesPanelElement: args.elements.newFilesPanelElement,
    newFilesPanelResizerElement: args.elements.newFilesPanelResizerElement,
    ensureExpandedProjects: args.sidebarHost.ensureExpandedProjects,
    getTreeMenuKey: args.sidebarHost.getTreeMenuKey,
    escapeHtml: args.formatters.escapeHtml,
    formatTimestamp: args.formatters.formatTimestamp,
    renderChevronIcon: args.icons.renderChevronIcon,
    renderProjectIcon: args.icons.renderProjectIcon,
    renderChatIcon: args.icons.renderChatIcon,
    renderMoreActionsIcon: args.icons.renderMoreActionsIcon,
    renderOpenInBrowserIcon: args.icons.renderOpenInBrowserIcon,
    renderFolderTreeIcon: args.icons.renderFolderTreeIcon,
    renderFileTreeFileIcon: args.icons.renderFileTreeFileIcon,
    renderArchiveIcon: args.icons.renderArchiveIcon,
    renderGitBranchIcon: args.icons.renderGitBranchIcon,
    renderApplyIcon: args.icons.renderApplyIcon,
    renderBusyIcon: args.icons.renderBusyIcon,
    renderCheckIcon: args.icons.renderCheckIcon,
    renderDownloadArrowIcon: args.icons.renderDownloadArrowIcon,
    getChatFileKey: args.queries.getChatFileKey,
    getSandboxFileBaseName: args.queries.getSandboxFileBaseName,
    getEffectiveDownloadPath: args.remoteFilesRuntime.getEffectiveDownloadPath,
    getArchiveEntriesForFile: (file) => args.remoteFilesState.archiveEntriesByFileKey.get(args.queries.getChatFileKey(file)) ?? [],
    ensureArchiveEntriesForVisibleNewFiles: args.remoteFilesRuntime.ensureArchiveEntriesForVisibleNewFiles,
    ensureNewFilesPanelHeight: args.sidebarHost.ensureNewFilesPanelHeight,
    applySidebarDetailsState: args.sidebarHost.applySidebarDetailsState,
    applySidebarTabState: args.sidebarHost.applySidebarTabState,
  };
}
