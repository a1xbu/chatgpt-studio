import type {
  AppStateSnapshot,
  ChatFileRecord,
  DebugLogEntry,
  ProjectChatRecord,
  SidebarProject,
} from '../../shared/contracts';
import type { ChatEditorTab } from '../editor/types';
import type { FileDownloadRuntimeStatus, WebviewElement } from '../runtime-types';
import type { BrowserNavigationState } from './navigation';
import type { SidebarSelection } from '../sidebar/types';
import type { BrowserController } from './controller';
import {
  getPairedChatSelection as getPairedChatSelectionImpl,
  isBrowserPairedWithChat as isBrowserPairedWithChatImpl,
  openBrowserForPairedChat as openBrowserForPairedChatImpl,
  openLocalChatInChatGpt as openLocalChatInChatGptImpl,
} from '../workbench/pairing';
import {
  handleBrowserSandboxFileStatus as handleBrowserSandboxFileStatusImpl,
  queueAutomaticSandboxDownloads as queueAutomaticSandboxDownloadsImpl,
  sendBrowserFileCommand as sendBrowserFileCommandImpl,
  type BrowserFileCommand,
} from './downloads';
import {
  resolvePreferredStartupBrowserSelection as resolvePreferredStartupBrowserSelectionImpl,
  resolvePreferredStartupBrowserUrl as resolvePreferredStartupBrowserUrlImpl,
  restoreLastOpenState as restoreLastOpenStateImpl,
  syncBrowserOpenedSelection as syncBrowserOpenedSelectionImpl,
} from './session';
import { loadLastActiveLocalChatSelection, loadLastBrowserOpenedSelection } from '../sidebar/storage';
import { persistBrowserOpenedSelection as persistBrowserOpenedSelectionImpl } from '../sidebar/runtime';

export type BrowserFeature = {
  selectors: {
    getPairedChatSelection: () => Extract<SidebarSelection, { kind: 'chat' }> | null;
    isBrowserPairedWithChat: (projectId: string, chatId: string) => boolean;
    resolvePreferredStartupBrowserSelection: (state: AppStateSnapshot) => SidebarSelection | null;
    resolvePreferredStartupBrowserUrl: (state: AppStateSnapshot) => string;
  };
  actions: {
    persistBrowserOpenedSelection: () => void;
    restoreLastOpenState: (state: AppStateSnapshot) => Promise<void>;
    openBrowserForPairedChat: (projectId: string, chatId: string, activateBrowser?: boolean) => boolean;
    syncBrowserOpenedSelection: (state: AppStateSnapshot) => void;
    openLocalChatInChatGpt: (projectId: string, chatId: string, chatUrl: string) => void;
    sendBrowserFileCommand: (command: BrowserFileCommand, file: ChatFileRecord) => void;
    queueAutomaticSandboxDownloads: () => void;
    handleBrowserSandboxFileStatus: (payload: unknown) => void;
    handleWebviewDidStartLoading: () => void;
    handleWebviewDidFinishLoad: () => void;
    handleWebviewDidStopLoading: (url: string | null | undefined) => void;
    handleWebviewDidFailLoad: (payload: { errorCode?: number; errorDescription?: string; validatedURL?: string }) => void;
    handleWebviewDidNavigate: (url: string | null | undefined) => void;
    handleWebviewDomReady: () => void;
  };
};

export type BrowserFeatureBaseOptions = Omit<
  BrowserFeatureOptions,
  'ensureChatHistoryTab' | 'openChatHistoryTab' | 'activateEditorTab' | 'reloadChatHistoryIntoTab' | 'markChatEditorTabStale' | 'findChatEditorTab' | 'addDebugLog'
>;

export type BrowserFeatureOptions = {
  storage: Storage;
  browserOpenedStorageKey: string;
  lastActiveLocalChatStorageKey: string;
  getCurrentState: () => AppStateSnapshot | null;
  getSelectedSidebarItem: () => SidebarSelection | null;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  getBrowserOpenedSidebarItem: () => SidebarSelection | null;
  setBrowserOpenedSidebarItem: (selection: SidebarSelection | null) => void;
  getBrowserNavigationState: () => BrowserNavigationState;
  setBrowserNavigationState: (nextState: BrowserNavigationState) => void;
  getHasRestoredLastOpenState: () => boolean;
  setHasRestoredLastOpenState: (value: boolean) => void;
  getDownloadAutomatically: () => boolean;
  setActiveEditorTabId: (tabId: string) => void;
  setActivePairedEditorSubtab: (value: 'browser' | 'local') => void;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  getLatestNewFiles: (projects: SidebarProject[], selection: SidebarSelection | null) => Array<{ project: SidebarProject; file: ChatFileRecord }>;
  getChatFileKey: (file: ChatFileRecord) => string;
  browserController: Pick<BrowserController, 'openUrl' | 'refreshNavigationState'>;
  browserElement: WebviewElement | null;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  setTimeout?: (callback: () => void, delayMs: number) => number;
  random?: () => number;
  ensureChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord, activate?: boolean) => Promise<unknown>;
  openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => Promise<unknown>;
  activateEditorTab: (tabId: string) => void;
  render: () => void;
  renderEditorArea: () => void;
  reloadChatHistoryIntoTab: (tab: ChatEditorTab, forceReload: boolean) => Promise<void>;
  markChatEditorTabStale: (projectId: string, chatId: string, options?: { revisionKey?: string | null; reloadIfVisible?: boolean }) => void;
  findChatEditorTab: (projectId: string, chatId: string) => ChatEditorTab | null;
  addDebugLog: (
    source: DebugLogEntry['source'],
    level: DebugLogEntry['level'],
    message: string,
    details?: string | null,
  ) => void;
  resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
  resolveProjectBrowserUrl: (project: SidebarProject) => string;
};

export function createBrowserFeature(options: BrowserFeatureOptions): BrowserFeature {
  function getBrowserNavigationState(): BrowserNavigationState {
    return options.getBrowserNavigationState();
  }

  function setBrowserNavigationState(nextState: BrowserNavigationState): void {
    options.setBrowserNavigationState(nextState);
  }

  function patchBrowserNavigationState(patch: Partial<BrowserNavigationState>): void {
    setBrowserNavigationState({
      ...getBrowserNavigationState(),
      ...patch,
    });
  }

  function loadStoredBrowserSelection(): SidebarSelection | null {
    return loadLastBrowserOpenedSelection(options.storage, options.browserOpenedStorageKey);
  }

  function loadStoredActiveLocalChatSelection(): SidebarSelection | null {
    return loadLastActiveLocalChatSelection(options.storage, options.lastActiveLocalChatStorageKey);
  }

  function getPairedChatSelection(): Extract<SidebarSelection, { kind: 'chat' }> | null {
    return getPairedChatSelectionImpl(options.getBrowserOpenedSidebarItem());
  }

  function isBrowserPairedWithChat(projectId: string, chatId: string): boolean {
    return isBrowserPairedWithChatImpl(options.getBrowserOpenedSidebarItem(), projectId, chatId);
  }

  function persistBrowserOpenedSelection(): void {
    persistBrowserOpenedSelectionImpl(
      options.storage,
      options.browserOpenedStorageKey,
      options.getBrowserOpenedSidebarItem(),
    );
  }

  function resolvePreferredStartupBrowserSelection(state: AppStateSnapshot): SidebarSelection | null {
    return resolvePreferredStartupBrowserSelectionImpl(state, {
      selectedSidebarItem: options.getSelectedSidebarItem(),
      loadLastBrowserOpenedSelection: loadStoredBrowserSelection,
      loadLastActiveLocalChatSelection: loadStoredActiveLocalChatSelection,
      findSidebarProject: options.findSidebarProject,
      findSidebarChat: options.findSidebarChat,
    });
  }

  function resolvePreferredStartupBrowserUrl(state: AppStateSnapshot): string {
    return resolvePreferredStartupBrowserUrlImpl(state, {
      selectedSidebarItem: options.getSelectedSidebarItem(),
      loadLastBrowserOpenedSelection: loadStoredBrowserSelection,
      loadLastActiveLocalChatSelection: loadStoredActiveLocalChatSelection,
      findSidebarProject: options.findSidebarProject,
      findSidebarChat: options.findSidebarChat,
      resolveChatBrowserUrl: options.resolveChatBrowserUrl,
      resolveProjectBrowserUrl: options.resolveProjectBrowserUrl,
      defaultUrl: 'https://chatgpt.com',
    });
  }

  async function restoreLastOpenState(state: AppStateSnapshot): Promise<void> {
    await restoreLastOpenStateImpl(state, {
      hasRestoredLastOpenState: options.getHasRestoredLastOpenState(),
      setHasRestoredLastOpenState: options.setHasRestoredLastOpenState,
      selectedSidebarItem: options.getSelectedSidebarItem(),
      setSelectedSidebarItem: options.setSelectedSidebarItem,
      loadLastBrowserOpenedSelection: loadStoredBrowserSelection,
      loadLastActiveLocalChatSelection: loadStoredActiveLocalChatSelection,
      findSidebarProject: options.findSidebarProject,
      findPersistentSidebarProject: options.findPersistentSidebarProject,
      findSidebarChat: options.findSidebarChat,
      setBrowserOpenedSidebarItem: options.setBrowserOpenedSidebarItem,
      persistBrowserOpenedSelection,
      openBrowserUrl: (url, openOptions) => {
        options.browserController.openUrl(url, openOptions);
      },
      resolveChatBrowserUrl: options.resolveChatBrowserUrl,
      resolveProjectBrowserUrl: options.resolveProjectBrowserUrl,
      openChatHistoryTab: options.openChatHistoryTab,
    });
  }

  function openBrowserForPairedChat(projectId: string, chatId: string, activateBrowser = true): boolean {
    return openBrowserForPairedChatImpl({
      currentState: options.getCurrentState(),
      projectId,
      chatId,
      activateBrowser,
      findSidebarProject: options.findSidebarProject,
      findSidebarChat: options.findSidebarChat,
      ensureChatHistoryTab: options.ensureChatHistoryTab,
      addDebugLog: options.addDebugLog,
      setBrowserOpenedSidebarItem: options.setBrowserOpenedSidebarItem,
      setActivePairedEditorSubtab: options.setActivePairedEditorSubtab,
      persistBrowserOpenedSelection,
      browserController: options.browserController,
      resolveChatBrowserUrl: options.resolveChatBrowserUrl,
      renderEditorArea: options.renderEditorArea,
    });
  }

  function syncBrowserOpenedSelection(state: AppStateSnapshot): void {
    syncBrowserOpenedSelectionImpl(state, {
      browserIsLoading: getBrowserNavigationState().browserIsLoading,
      browserOpenedSidebarItem: options.getBrowserOpenedSidebarItem(),
      setBrowserOpenedSidebarItem: options.setBrowserOpenedSidebarItem,
      persistBrowserOpenedSelection,
      findSidebarProject: options.findSidebarProject,
      findSidebarChat: options.findSidebarChat,
      getPairedChatSelection,
      ensureChatHistoryTab: options.ensureChatHistoryTab,
      addDebugLog: options.addDebugLog,
    });
  }

  function openLocalChatInChatGpt(projectId: string, chatId: string, chatUrl: string): void {
    openLocalChatInChatGptImpl({
      projectId,
      chatId,
      chatUrl,
      setSelectedSidebarItem: options.setSelectedSidebarItem,
      isBrowserPairedWithChat,
      setActiveEditorTabId: options.setActiveEditorTabId,
      setActivePairedEditorSubtab: options.setActivePairedEditorSubtab,
      renderEditorArea: options.renderEditorArea,
      openBrowserForPairedChat,
      activateEditorTab: options.activateEditorTab,
      browserController: options.browserController,
    });
  }

  function sendBrowserFileCommand(command: BrowserFileCommand, file: ChatFileRecord): void {
    sendBrowserFileCommandImpl(command, file, {
      browserElement: options.browserElement,
      addDebugLog: options.addDebugLog,
    });
  }

  function queueAutomaticSandboxDownloads(): void {
    queueAutomaticSandboxDownloadsImpl({
      downloadAutomatically: options.getDownloadAutomatically(),
      currentState: options.getCurrentState(),
      selectedSidebarItem: options.getSelectedSidebarItem(),
      fileDownloadStatuses: options.fileDownloadStatuses,
      getAllSidebarProjects: options.getAllSidebarProjects,
      getLatestNewFiles: options.getLatestNewFiles,
      getChatFileKey: options.getChatFileKey,
      sendBrowserFileCommand,
      isDownloadAutomaticallyEnabled: options.getDownloadAutomatically,
      setTimeout: options.setTimeout,
      random: options.random,
      render: options.render,
    });
  }

  function handleBrowserSandboxFileStatus(payload: unknown): void {
    handleBrowserSandboxFileStatusImpl(payload, {
      fileDownloadStatuses: options.fileDownloadStatuses,
      findChatEditorTab: options.findChatEditorTab,
      reloadChatHistoryIntoTab: options.reloadChatHistoryIntoTab,
      render: options.render,
    });
  }

  function clearPendingDownloadStatuses(): void {
    for (const [fileKey, status] of options.fileDownloadStatuses.entries()) {
      if (status.status === 'waiting' || status.status === 'resolving' || status.status === 'downloading' || status.status === 'saving') {
        options.fileDownloadStatuses.delete(fileKey);
      }
    }
  }

  function handleWebviewDidStartLoading(): void {
    options.addDebugLog('webview', 'info', 'Webview started loading ChatGPT.');
    const pairedSelection = getPairedChatSelection();
    if (pairedSelection) {
      options.markChatEditorTabStale(pairedSelection.projectId, pairedSelection.chatId);
    }
    clearPendingDownloadStatuses();
    patchBrowserNavigationState({
      browserIsLoading: true,
    });
    options.browserController.refreshNavigationState();
  }

  function handleWebviewDidFinishLoad(): void {
    options.addDebugLog('webview', 'info', 'Webview finished loading ChatGPT.');
    options.browserController.refreshNavigationState();
  }

  function handleWebviewDidStopLoading(url: string | null | undefined): void {
    patchBrowserNavigationState({
      browserIsLoading: false,
      pendingBrowserUrl: null,
    });
    const currentState = options.getCurrentState();
    if (currentState) {
      syncBrowserOpenedSelection(currentState);
    }
    options.browserController.refreshNavigationState(url ?? undefined);
  }

  function handleWebviewDidFailLoad(payload: { errorCode?: number; errorDescription?: string; validatedURL?: string }): void {
    options.addDebugLog(
      'webview',
      'error',
      'Webview failed to load a page.',
      `code=${String(payload.errorCode ?? 'n/a')} description=${payload.errorDescription ?? 'n/a'} url=${payload.validatedURL ?? 'n/a'}`,
    );
    patchBrowserNavigationState({
      browserIsLoading: false,
      pendingBrowserUrl: null,
    });
    const currentState = options.getCurrentState();
    if (currentState) {
      syncBrowserOpenedSelection(currentState);
    }
    options.browserController.refreshNavigationState(payload.validatedURL ?? undefined);
  }

  function handleWebviewDidNavigate(url: string | null | undefined): void {
    options.browserController.refreshNavigationState(url ?? undefined);
  }

  function handleWebviewDomReady(): void {
    options.browserController.refreshNavigationState();
    queueAutomaticSandboxDownloads();
  }

  return {
    selectors: {
      getPairedChatSelection,
      isBrowserPairedWithChat,
      resolvePreferredStartupBrowserSelection,
      resolvePreferredStartupBrowserUrl,
    },
    actions: {
      persistBrowserOpenedSelection,
      restoreLastOpenState,
      openBrowserForPairedChat,
      syncBrowserOpenedSelection,
      openLocalChatInChatGpt,
      sendBrowserFileCommand,
      queueAutomaticSandboxDownloads,
      handleBrowserSandboxFileStatus,
      handleWebviewDidStartLoading,
      handleWebviewDidFinishLoad,
      handleWebviewDidStopLoading,
      handleWebviewDidFailLoad,
      handleWebviewDidNavigate,
      handleWebviewDomReady,
    },
  };
}
