import type {
  AppStateSnapshot,
  ChatFileArchiveEntryRecord,
  ChatFileRecord,
  ProjectChatRecord,
  SidebarProject,
} from '../../shared/contracts';
import { findLatestNewFileByKey as findLatestNewFileByKeyImpl, syncNewFilesCollapsedState as syncNewFilesCollapsedStateImpl } from '../files/runtime';
import { renderNewFilesPanel as renderNewFilesPanelRuntime } from '../remote-files/runtime-view';
import { renderProjectTreePanel as renderProjectTreePanelImpl } from '../render/workbench';
import { renderProjectTree as renderProjectTreeRuntime } from './project-tree-view';
import { syncSidebarSelection as syncSidebarSelectionImpl } from './runtime';
import type { SidebarSelection, SidebarTabId, TreeMenuState } from './types';

export type SidebarFeatureEntry = {
  project: SidebarProject;
  file: ChatFileRecord;
};

export type SidebarFeature = {
  selectors: {
    getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
    findLatestNewFileByKey: (fileKey: string) => SidebarFeatureEntry | null;
    getLatestEntries: (state: AppStateSnapshot) => SidebarFeatureEntry[];
    getLatestEntriesForCurrentState: () => SidebarFeatureEntry[];
  };
  actions: {
    syncSidebarSelection: (state: AppStateSnapshot) => void;
    syncNewFilesCollapsedState: (entries: SidebarFeatureEntry[]) => void;
  };
  render: {
    projectTree: (state: AppStateSnapshot) => string;
    newFilesPanel: (state: AppStateSnapshot) => void;
    sidebar: () => void;
  };
};

export type SidebarFeatureOptions = {
  getCurrentState: () => AppStateSnapshot | null;
  getSelectedSidebarItem: () => SidebarSelection | null;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  getLatestNewFiles: (projects: SidebarProject[], selectedSidebarItem: SidebarSelection | null) => SidebarFeatureEntry[];
  findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  expandedProjectIds: Set<string>;
  expandedNewFilesKeys: Set<string>;
  fileDownloadStatuses: Map<string, import('../runtime-types').FileDownloadRuntimeStatus>;
  getLastNewFilesSignature: () => string;
  setLastNewFilesSignature: (value: string) => void;
  getIsNewFilesCollapsed: () => boolean;
  setIsNewFilesCollapsed: (value: boolean) => void;
  getRemoteFilesNotice: () => { message: string; tone: 'info' | 'success' | 'error' } | null;
  getDownloadAutomatically: () => boolean;
  getActiveSidebarTabId: () => SidebarTabId;
  getActiveTreeMenu: () => TreeMenuState | null;
  persistSidebarSelection: (selection: SidebarSelection | null) => void;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  persistCollapsedState: (value: boolean) => void;
  projectListElement: HTMLElement | null;
  newFilesPanelElement: HTMLElement | null;
  newFilesPanelResizerElement: HTMLElement | null;
  ensureExpandedProjects: (state: AppStateSnapshot) => void;
  getTreeMenuKey: (state: TreeMenuState | null) => string;
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  renderChevronIcon: () => string;
  renderProjectIcon: () => string;
  renderChatIcon: () => string;
  renderMoreActionsIcon: () => string;
  renderOpenInBrowserIcon: () => string;
  renderFolderTreeIcon: (isOpen?: boolean) => string;
  renderFileTreeFileIcon: () => string;
  renderArchiveIcon: () => string;
  renderGitBranchIcon: () => string;
  renderApplyIcon: () => string;
  renderBusyIcon: () => string;
  renderCheckIcon: () => string;
  renderDownloadArrowIcon: () => string;
  getChatFileKey: (file: ChatFileRecord) => string;
  getSandboxFileBaseName: (file: ChatFileRecord) => string;
  getEffectiveDownloadPath: (file: ChatFileRecord) => string | null;
  getArchiveEntriesForFile: (file: ChatFileRecord) => ChatFileArchiveEntryRecord[];
  ensureArchiveEntriesForVisibleNewFiles: (entries: SidebarFeatureEntry[]) => void;
  ensureNewFilesPanelHeight: () => void;
  applySidebarDetailsState: (hasNewFiles: boolean) => void;
  applySidebarTabState: () => void;
};

function getLatestEntries(
  state: AppStateSnapshot,
  options: Pick<SidebarFeatureOptions, 'getLatestNewFiles' | 'getAllSidebarProjects' | 'getSelectedSidebarItem'>,
): SidebarFeatureEntry[] {
  return options.getLatestNewFiles(
    options.getAllSidebarProjects(state),
    options.getSelectedSidebarItem(),
  );
}

function getActiveSidebarProject(
  state: AppStateSnapshot,
  options: Pick<SidebarFeatureOptions, 'getSelectedSidebarItem' | 'findPersistentSidebarProject' | 'findSidebarProject'>,
): SidebarProject | null {
  const selectedSidebarItem = options.getSelectedSidebarItem();
  if (!selectedSidebarItem?.projectId) {
    return null;
  }

  return options.findPersistentSidebarProject(state, selectedSidebarItem.projectId)
    ?? options.findSidebarProject(state, selectedSidebarItem.projectId);
}

function findLatestNewFileByKey(
  fileKey: string,
  options: Pick<SidebarFeatureOptions, 'getCurrentState' | 'getSelectedSidebarItem' | 'getAllSidebarProjects'>,
): SidebarFeatureEntry | null {
  return findLatestNewFileByKeyImpl({
    currentState: options.getCurrentState(),
    selectedSidebarItem: options.getSelectedSidebarItem(),
    fileKey,
    getAllSidebarProjects: options.getAllSidebarProjects,
  });
}

function syncSidebarSelection(
  state: AppStateSnapshot,
  options: Pick<SidebarFeatureOptions, 'getSelectedSidebarItem' | 'setSelectedSidebarItem' | 'persistSidebarSelection' | 'findSidebarProject' | 'findSidebarChat'>,
): void {
  syncSidebarSelectionImpl({
    state,
    selectedSidebarItem: options.getSelectedSidebarItem(),
    setSelectedSidebarItem: options.setSelectedSidebarItem,
    persistSidebarSelection: options.persistSidebarSelection,
    findSidebarProject: options.findSidebarProject,
    findSidebarChat: options.findSidebarChat,
  });
}

function syncNewFilesCollapsedState(
  entries: SidebarFeatureEntry[],
  options: Pick<SidebarFeatureOptions, 'getLastNewFilesSignature' | 'setLastNewFilesSignature' | 'setIsNewFilesCollapsed' | 'persistCollapsedState'>,
): void {
  syncNewFilesCollapsedStateImpl({
    entries,
    lastNewFilesSignature: options.getLastNewFilesSignature(),
    setLastNewFilesSignature: options.setLastNewFilesSignature,
    setIsNewFilesCollapsed: options.setIsNewFilesCollapsed,
    persistCollapsedState: options.persistCollapsedState,
  });
}

function renderProjectTree(
  state: AppStateSnapshot,
  options: Pick<SidebarFeatureOptions,
    | 'getSelectedSidebarItem'
    | 'expandedProjectIds'
    | 'getActiveTreeMenu'
    | 'ensureExpandedProjects'
    | 'getTreeMenuKey'
    | 'escapeHtml'
    | 'formatTimestamp'
    | 'renderChevronIcon'
    | 'renderProjectIcon'
    | 'renderChatIcon'
    | 'renderMoreActionsIcon'
    | 'renderOpenInBrowserIcon'
  >,
): string {
  return renderProjectTreeRuntime({
    state,
    selectedSidebarItem: options.getSelectedSidebarItem(),
    expandedProjectIds: options.expandedProjectIds,
    activeTreeMenu: options.getActiveTreeMenu(),
    ensureExpandedProjects: options.ensureExpandedProjects,
    getTreeMenuKey: options.getTreeMenuKey,
    escapeHtml: options.escapeHtml,
    formatTreeTimestamp: options.formatTimestamp,
    renderChevronIcon: options.renderChevronIcon,
    renderProjectIcon: options.renderProjectIcon,
    renderChatIcon: options.renderChatIcon,
    renderMoreActionsIcon: options.renderMoreActionsIcon,
    renderOpenInBrowserIcon: options.renderOpenInBrowserIcon,
  });
}

function renderNewFilesPanel(
  state: AppStateSnapshot,
  options: SidebarFeatureOptions,
  selectors: Pick<SidebarFeature['selectors'], 'getActiveSidebarProject' | 'getLatestEntries'>,
  actions: Pick<SidebarFeature['actions'], 'syncNewFilesCollapsedState'>,
): void {
  renderNewFilesPanelRuntime({
    state,
    newFilesPanelElement: options.newFilesPanelElement,
    newFilesPanelResizerElement: options.newFilesPanelResizerElement,
    isNewFilesCollapsed: options.getIsNewFilesCollapsed(),
    setIsNewFilesCollapsed: () => undefined,
    persistCollapsedState: () => undefined,
    getActiveSidebarProject: selectors.getActiveSidebarProject,
    getLatestEntries: selectors.getLatestEntries,
    syncNewFilesCollapsedState: actions.syncNewFilesCollapsedState,
    ensureArchiveEntriesForVisibleNewFiles: options.ensureArchiveEntriesForVisibleNewFiles,
    ensureNewFilesPanelHeight: options.ensureNewFilesPanelHeight,
    downloadAutomatically: options.getDownloadAutomatically(),
    remoteFilesNotice: options.getRemoteFilesNotice(),
    escapeHtml: options.escapeHtml,
    formatTimestamp: options.formatTimestamp,
    renderApplyIcon: options.renderApplyIcon,
    renderArchiveIcon: options.renderArchiveIcon,
    renderGitBranchIcon: options.renderGitBranchIcon,
    renderBusyIcon: options.renderBusyIcon,
    renderCheckIcon: options.renderCheckIcon,
    renderChevronIcon: options.renderChevronIcon,
    renderDownloadArrowIcon: options.renderDownloadArrowIcon,
    renderFileTreeFileIcon: options.renderFileTreeFileIcon,
    renderFolderTreeIcon: options.renderFolderTreeIcon,
    getChatFileKey: (file) => options.getChatFileKey(file as ChatFileRecord),
    getSandboxFileBaseName: (file) => options.getSandboxFileBaseName(file as ChatFileRecord),
    getEffectiveDownloadPath: options.getEffectiveDownloadPath,
    getDownloadRuntimeStatus: (file) => options.fileDownloadStatuses.get(options.getChatFileKey(file)) ?? null,
    getArchiveEntriesForFile: options.getArchiveEntriesForFile,
    expandedNewFilesKeys: options.expandedNewFilesKeys,
  });
}

export function createSidebarFeature(options: SidebarFeatureOptions): SidebarFeature {
  const feature: SidebarFeature = {
    selectors: {
      getActiveSidebarProject: (state) => getActiveSidebarProject(state, options),
      findLatestNewFileByKey: (fileKey) => findLatestNewFileByKey(fileKey, options),
      getLatestEntries: (state) => getLatestEntries(state, options),
      getLatestEntriesForCurrentState: () => {
        const currentState = options.getCurrentState();
        return currentState ? getLatestEntries(currentState, options) : [];
      },
    },
    actions: {
      syncSidebarSelection: (state) => syncSidebarSelection(state, options),
      syncNewFilesCollapsedState: (entries) => syncNewFilesCollapsedState(entries, options),
    },
    render: {
      projectTree: (state) => renderProjectTree(state, options),
      newFilesPanel: (state) => renderNewFilesPanel(state, options, feature.selectors, feature.actions),
      sidebar: () => {
        const currentState = options.getCurrentState();
        if (!currentState || !options.projectListElement) {
          return;
        }

        const latestEntries = feature.selectors.getLatestEntries(currentState);
        options.applySidebarDetailsState(latestEntries.length > 0);
        options.applySidebarTabState();
        feature.actions.syncSidebarSelection(currentState);
        renderProjectTreePanelImpl(
          currentState,
          { projectListElement: options.projectListElement },
          feature.render.projectTree,
        );
        feature.render.newFilesPanel(currentState);
      },
    },
  };

  return feature;
}
