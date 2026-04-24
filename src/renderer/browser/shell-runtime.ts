import type {
  AppStateSnapshot,
  ChatFileRecord,
  ProjectChatRecord,
  SidebarProject,
} from '../../shared/contracts';
import type {
  RendererAppStoreSlice,
  RendererBrowserStoreSlice,
  RendererStore,
  RendererRemoteFilesStoreSlice,
  RendererWorkspaceStoreSlice,
} from '../app/store';
import type { RendererBrowserBindingsSlice } from '../bootstrap/renderer-context';
import type { SidebarSelection } from '../sidebar/types';
import type { RendererWorkbenchHost } from '../workbench/host';
import type { BrowserFeature, BrowserFeatureBaseOptions } from './feature';

export type CreateRendererBrowserFeatureBaseOptionsArgs = {
  appState: RendererAppStoreSlice;
  workspaceState: RendererWorkspaceStoreSlice;
  remoteFilesState: RendererRemoteFilesStoreSlice;
  browserState: RendererBrowserStoreSlice;
  workbenchHost: Pick<RendererWorkbenchHost, 'setActiveEditorTabId' | 'setActivePairedEditorSubtab'>;
  store: Pick<RendererStore, 'getBrowserNavigationState' | 'setBrowserNavigationState'>;
  storage: Storage;
  storageKeys: {
    browserOpened: string;
    lastActiveLocalChat: string;
  };
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  browserController: BrowserFeatureBaseOptions['browserController'];
  browserElement: BrowserFeatureBaseOptions['browserElement'];
  renderApp: () => void;
  renderEditorArea: () => void;
  queries: {
    findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
    getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
    getLatestNewFiles: (
      projects: SidebarProject[],
      selection: SidebarSelection | null,
    ) => Array<{ project: SidebarProject; file: ChatFileRecord }>;
    getChatFileKey: (file: ChatFileRecord) => string;
    resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
    resolveProjectBrowserUrl: (project: SidebarProject) => string;
  };
};

export type CreateRendererBrowserBindingsSliceArgs = {
  browserState: RendererBrowserStoreSlice;
  getFeature: () => Pick<BrowserFeature, 'actions'>;
  resolveChatBrowserUrl: BrowserFeatureBaseOptions['resolveChatBrowserUrl'];
  resolveProjectBrowserUrl: BrowserFeatureBaseOptions['resolveProjectBrowserUrl'];
};

export function createRendererBrowserFeatureBaseOptions(
  args: CreateRendererBrowserFeatureBaseOptionsArgs,
): BrowserFeatureBaseOptions {
  return {
    storage: args.storage,
    browserOpenedStorageKey: args.storageKeys.browserOpened,
    lastActiveLocalChatStorageKey: args.storageKeys.lastActiveLocalChat,
    getCurrentState: () => args.appState.currentState,
    getSelectedSidebarItem: () => args.workspaceState.selectedSidebarItem,
    setSelectedSidebarItem: args.setSelectedSidebarItem,
    getBrowserOpenedSidebarItem: () => args.browserState.browserOpenedSidebarItem,
    setBrowserOpenedSidebarItem: (selection) => {
      args.browserState.browserOpenedSidebarItem = selection;
    },
    getBrowserNavigationState: args.store.getBrowserNavigationState,
    setBrowserNavigationState: args.store.setBrowserNavigationState,
    getHasRestoredLastOpenState: () => args.browserState.hasRestoredLastOpenState,
    setHasRestoredLastOpenState: (value) => {
      args.browserState.hasRestoredLastOpenState = value;
    },
    getDownloadAutomatically: () => args.remoteFilesState.downloadAutomatically,
    setActiveEditorTabId: args.workbenchHost.setActiveEditorTabId,
    setActivePairedEditorSubtab: args.workbenchHost.setActivePairedEditorSubtab,
    findSidebarProject: args.queries.findSidebarProject,
    findPersistentSidebarProject: args.queries.findPersistentSidebarProject,
    findSidebarChat: args.queries.findSidebarChat,
    getAllSidebarProjects: args.queries.getAllSidebarProjects,
    getLatestNewFiles: args.queries.getLatestNewFiles,
    getChatFileKey: args.queries.getChatFileKey,
    browserController: args.browserController,
    browserElement: args.browserElement,
    fileDownloadStatuses: args.remoteFilesState.fileDownloadStatuses,
    render: args.renderApp,
    renderEditorArea: args.renderEditorArea,
    resolveChatBrowserUrl: args.queries.resolveChatBrowserUrl,
    resolveProjectBrowserUrl: args.queries.resolveProjectBrowserUrl,
  };
}

export function createRendererBrowserBindingsSlice(
  args: CreateRendererBrowserBindingsSliceArgs,
): RendererBrowserBindingsSlice {
  return {
    state: {
      setBrowserOpenedSidebarItem: (selection) => {
        args.browserState.browserOpenedSidebarItem = selection;
      },
      persistBrowserOpenedSelection: () => {
        args.getFeature().actions.persistBrowserOpenedSelection();
      },
    },
    actions: {
      persistBrowserOpenedSelection: () => {
        args.getFeature().actions.persistBrowserOpenedSelection();
      },
      sendBrowserFileCommand: (command, file) => {
        args.getFeature().actions.sendBrowserFileCommand(command, file);
      },
      queueAutomaticSandboxDownloads: () => {
        args.getFeature().actions.queueAutomaticSandboxDownloads();
      },
      resolveProjectBrowserUrl: args.resolveProjectBrowserUrl,
      resolveChatBrowserUrl: args.resolveChatBrowserUrl,
    },
  };
}
