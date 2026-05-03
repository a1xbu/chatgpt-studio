import type { AppStateSnapshot, ChatFileRecord, DebugLogEntry, ProjectChatRecord, PromptRecord, SidebarProject } from '../../shared/contracts';
import { runRendererBootstrap } from './init';
import { applyInitialRendererUiState } from './ui-state';
import type { ChatHistoryUpdatePayload, DesktopPocApi, LocalProjectFileEntry, TerminalDataPayload, TerminalExitPayload, TerminalSessionSnapshot, TerminalSessionState } from '../desktop-api';
import type { PromptEditorTab } from '../editor/types';
import type { SidebarSelection, SidebarTabId, TreeMenuState } from '../sidebar/types';
import type { FileDownloadRuntimeStatus, WebviewElement } from '../runtime-types';
import type { BrowserController } from '../browser/controller';
import { installRendererBindings, type InstallRendererBindingsElements } from './bindings';

export type RendererBootstrapCompositionOptions = {
  elements: Pick<InstallRendererBindingsElements, 'browserElement' | 'browserUrlElement'>;
  localStorage: Storage;
  storageKeys: {
    sidebarWidth: string;
    debugHeight: string;
    debugRetention: string;
    sidebarSelection: string;
    debugCollapsed: string;
  };
  limits: {
    minSidebarWidth: number;
    maxSidebarWidth: number;
    minDebugPanelHeight: number;
    maxDebugPanelHeight: number;
    maxDebugLogs: number;
  };
  uiState: {
    applySidebarWidth: (width: number) => void;
    applySidebarTabState: () => void;
    applyDebugPanelHeight: (height: number) => void;
    applyDebugPanelState: () => void;
    installSidebarResizer: () => void;
    installSidebarDetailsResizer: () => void;
    installBottomPanelResizer: () => void;
    installNewFilesPanelResizer: () => void;
    applyNewFilesPanelHeight: (height: number) => void;
  };
  desktopPoc: Pick<DesktopPocApi, 'getBootstrap' | 'onStateChanged' | 'onDebugEntry' | 'onChatHistoryUpdated' | 'onTerminalData' | 'onTerminalExit'>;
  state: {
    getCurrentState: () => AppStateSnapshot | null;
    setCurrentState: (state: AppStateSnapshot) => void;
    setDebugLogs: (entries: DebugLogEntry[]) => void;
    setTerminalSessions: (sessions: TerminalSessionState[]) => void;
    setBrowserOpenedSidebarItem: (selection: SidebarSelection | null) => void;
    persistBrowserOpenedSelection: () => void;
    setDebugRetentionLimit: (value: number) => void;
    setSelectedSidebarItem: (value: SidebarSelection | null) => void;
    setIsDebugPanelCollapsed: (value: boolean) => void;
  };
  actions: {
    syncProjectFileSignatures: (state: AppStateSnapshot) => void;
    refreshPrompts: () => Promise<void>;
    createTerminalSessionState: (snapshot: TerminalSessionSnapshot) => TerminalSessionState;
    resolveStartupBrowserUrl: (state: AppStateSnapshot, payload: Awaited<ReturnType<DesktopPocApi['getBootstrap']>>) => string;
    resolveStartupBrowserSelection: (state: AppStateSnapshot) => SidebarSelection | null;
    queueAutomaticSandboxDownloads: () => void;
    render: () => void;
    restoreLastOpenState: (state: AppStateSnapshot) => Promise<void>;
    addDebugLog: (source: DebugLogEntry['source'], level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
    pushDebugLogEntry: (entry: DebugLogEntry) => void;
    handleChatHistoryUpdated: (payload: ChatHistoryUpdatePayload) => void;
    handleBrowserDidStartLoading: () => void;
    handleBrowserDidFinishLoad: () => void;
    handleBrowserDidStopLoading: (url: string | null | undefined) => void;
    handleBrowserDidFailLoad: (payload: { errorCode?: number; errorDescription?: string; validatedURL?: string }) => void;
    handleBrowserDidNavigate: (url: string | null | undefined) => void;
    handleBrowserDomReady: () => void;
    handleBrowserSandboxFileStatus: (payload: unknown) => void;
    handleTerminalData: (payload: TerminalDataPayload) => void;
    handleTerminalExit: (payload: TerminalExitPayload) => void;
    scheduleTerminalFit: () => void;
  };
  browserController: Pick<BrowserController, 'updateUrl' | 'syncControls'>;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
};

export async function runComposedRendererBootstrap(options: RendererBootstrapCompositionOptions): Promise<void> {
  await runRendererBootstrap({
    browserElement: options.elements.browserElement as WebviewElement | null,
    browserUrlElement: options.elements.browserUrlElement,
    applyInitialUiState: () => {
      applyInitialRendererUiState({
        storage: options.localStorage,
        sidebarWidthStorageKey: options.storageKeys.sidebarWidth,
        debugHeightStorageKey: options.storageKeys.debugHeight,
        debugRetentionStorageKey: options.storageKeys.debugRetention,
        sidebarSelectionStorageKey: options.storageKeys.sidebarSelection,
        debugCollapsedStorageKey: options.storageKeys.debugCollapsed,
        minSidebarWidth: options.limits.minSidebarWidth,
        maxSidebarWidth: options.limits.maxSidebarWidth,
        minDebugPanelHeight: options.limits.minDebugPanelHeight,
        maxDebugPanelHeight: options.limits.maxDebugPanelHeight,
        applySidebarWidth: options.uiState.applySidebarWidth,
        applySidebarTabState: options.uiState.applySidebarTabState,
        applyDebugPanelHeight: options.uiState.applyDebugPanelHeight,
        setDebugRetentionLimit: options.state.setDebugRetentionLimit,
        setSelectedSidebarItem: options.state.setSelectedSidebarItem,
        setIsDebugPanelCollapsed: options.state.setIsDebugPanelCollapsed,
        applyDebugPanelState: options.uiState.applyDebugPanelState,
        installSidebarResizer: options.uiState.installSidebarResizer,
        installSidebarDetailsResizer: options.uiState.installSidebarDetailsResizer,
        installBottomPanelResizer: options.uiState.installBottomPanelResizer,
        installNewFilesPanelResizer: options.uiState.installNewFilesPanelResizer,
      });
    },
    getBootstrap: () => options.desktopPoc.getBootstrap(),
    setCurrentState: options.state.setCurrentState,
    syncProjectFileSignatures: options.actions.syncProjectFileSignatures,
    setDebugLogs: options.state.setDebugLogs,
    maxDebugLogs: options.limits.maxDebugLogs,
    createTerminalSessionState: options.actions.createTerminalSessionState,
    setTerminalSessions: options.state.setTerminalSessions,
    refreshPrompts: options.actions.refreshPrompts,
    runtimeOptions: {
      desktopPoc: options.desktopPoc,
      browserElement: options.elements.browserElement as WebviewElement,
      handleDesktopStateChanged: (state) => {
        options.state.setCurrentState(state);
        options.actions.syncProjectFileSignatures(state);
        options.actions.queueAutomaticSandboxDownloads();
        options.actions.render();
      },
      handleDebugEntry: options.actions.pushDebugLogEntry,
      handleChatHistoryUpdated: options.actions.handleChatHistoryUpdated,
      handleBrowserDidStartLoading: options.actions.handleBrowserDidStartLoading,
      handleBrowserDidFinishLoad: options.actions.handleBrowserDidFinishLoad,
      handleBrowserDidStopLoading: options.actions.handleBrowserDidStopLoading,
      handleBrowserDidFailLoad: options.actions.handleBrowserDidFailLoad,
      handleBrowserDidNavigate: options.actions.handleBrowserDidNavigate,
      handleBrowserDomReady: options.actions.handleBrowserDomReady,
      handleBrowserSandboxFileStatus: options.actions.handleBrowserSandboxFileStatus,
      handleTerminalData: options.actions.handleTerminalData,
      handleTerminalExit: options.actions.handleTerminalExit,
      addDebugLog: options.actions.addDebugLog,
      handleResize: () => {
        options.actions.scheduleTerminalFit();
        const currentHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--new-files-panel-height'));
        if (Number.isFinite(currentHeight)) {
          options.uiState.applyNewFilesPanelHeight(currentHeight);
        }
      },
    },
    resolveStartupBrowserUrl: options.actions.resolveStartupBrowserUrl,
    resolveStartupBrowserSelection: options.actions.resolveStartupBrowserSelection,
    setBrowserOpenedSidebarItem: options.state.setBrowserOpenedSidebarItem,
    persistBrowserOpenedSelection: options.state.persistBrowserOpenedSelection,
    browserController: options.browserController,
    queueAutomaticSandboxDownloads: options.actions.queueAutomaticSandboxDownloads,
    render: options.actions.render,
    restoreLastOpenState: options.actions.restoreLastOpenState,
  });
}

export type RendererBindingsCompositionOptions = {
  elements: InstallRendererBindingsElements;
  localStorage: Storage;
  desktopPoc: Pick<DesktopPocApi,
    'openFolder' | 'createProjectBundle' | 'startFileDrag' | 'openPromptsFolder' | 'deletePrompt' |
    'showItemInFolder' | 'removeChat' | 'connectProject' | 'removeProject'
  >;
  browserController: Pick<BrowserController, 'normalizeAddress' | 'openUrl'>;
  promptContentCache: Map<string, string>;
  prompts: PromptRecord[];
  expandedProjectIds: Set<string>;
  expandedLocalDirectoryKeys: Set<string>;
  projectBundleCreateInFlightIds: Set<string>;
  projectBundleErrorsByProjectId: Map<string, string>;
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  collapsedGitCommitDirectoryKeys: Set<string>;
  archiveEntriesByFileKey: Map<string, unknown[]>;
  expandedNewFilesKeys: Set<string>;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  constants: {
    activeSidebarTabStorageKey: string;
    debugRetentionStorageKey: string;
    downloadAutomaticallyStorageKey: string;
  };
  state: {
    getCurrentState: () => AppStateSnapshot | null;
    getActiveSidebarTabId: () => SidebarTabId;
    setActiveSidebarTabId: (nextTab: SidebarTabId) => void;
    toggleBottomPanel: () => void;
    getActiveTreeMenu: () => TreeMenuState | null;
    setActiveTreeMenu: (state: TreeMenuState | null) => void;
    setPropertiesDialogProject: (projectId: string) => void;
    setPropertiesDialogChat: (projectId: string, chatId: string) => void;
    setBrowserOpenedSidebarItem: (selection: SidebarSelection | null) => void;
    persistBrowserOpenedSelection: () => void;
    setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
    getGitPanelProjectId: () => string | null;
    getSelectedGitRefName: () => string | null;
    setSelectedGitBranchName: (branchName: string | null) => void;
    getSelectedGitCommitHash: () => string | null;
    setSelectedGitCommitHash: (commitHash: string | null) => void;
    clearGitCommitDetailsState: (isLoading: boolean) => void;
    setGitPanelLoadError: (message: string | null) => void;
    setDebugFilterText: (value: string) => void;
    setDebugRetentionLimit: (value: number) => void;
    setDownloadAutomatically: (checked: boolean) => void;
    isPromptNameDialogOpen: () => boolean;
    isArchiveApplyWarningOpen: () => boolean;
    closePropertiesDialog: () => void;
    isPropertiesDialogOpen: () => boolean;
    isActiveTreeMenuOpen: () => boolean;
    closeActiveTreeMenu: () => void;
    isActivePromptMenuOpen: () => boolean;
    closeActivePromptMenu: () => void;
    getPromptById: (promptId: string) => PromptRecord | null;
  };
  actions: {
    findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
    persistActiveSidebarTabId: (nextTab: SidebarTabId) => void;
    ensureFilesViewLoaded: () => void;
    render: () => void;
    refreshLocalProjectTree: (projectId: string) => void;
    renderFileViewPanel: (state: unknown, preserveScroll?: boolean) => void;
    getLocalFileTreeKey: (projectId: string, relativePath?: string) => string;
    loadLocalFileTree: (projectId: string, relativePath?: string) => Promise<void>;
    openCreatePromptDialog: () => void;
    setActivePromptMenu: (promptId: string, shouldToggle?: boolean) => void;
    openPromptTab: (promptId: string) => Promise<void>;
    showPromptError: (message: string) => void;
    findPromptEditorTab: (promptId: string) => PromptEditorTab | null;
    enterPromptEditMode: (promptId: string) => void;
    savePromptTab: (promptId: string) => void;
    cancelPromptEditing: (promptId: string) => void;
    closeEditorTab: (tabId: string) => void;
    activatePairedEditorView: (view: 'browser' | 'local') => void;
    activateEditorTab: (tabId: string) => void;
    copyVisibleDebugLogs: () => Promise<void>;
    clearDebugLogs: () => Promise<void>;
    openEmbeddedTerminal: () => Promise<void>;
    closeTerminalSession: (sessionId: string) => Promise<void>;
    switchBottomTab: (tabId: string) => void;
    renderDebugLogs: () => void;
    refreshGitPanel: (projectId: string, refName?: string | null) => Promise<void>;
    renderBottomPanel: () => void;
    renderGitPanel: () => void;
    refreshGitCommitDetails: (projectId: string, commitHash: string | null) => Promise<void>;
    getGitCommitDirectoryKey: (commitHash: string, relativePath?: string) => string;
    clearActiveTreeMenuCloseTimer: () => void;
    scheduleActiveTreeMenuClose: () => void;
    persistExpandedProjectIds: () => void;
    persistBrowserOpenedSelection: () => void;
    openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => Promise<void>;
    getChatEditorTabId: (projectId: string, chatId: string) => string;
    hasEditorTab: (tabId: string) => boolean;
    submitPromptNameDialog: (rawValue: string) => Promise<void>;
    closePromptNameDialog: () => void;
    getRemoteManifestPrompt: (projectId: string) => string;
    getEffectiveProjectId: (requestedProjectId: string) => string;
    writeClipboardText: (text: string) => Promise<void>;
    showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
    findLatestNewFileByKey: (fileKey: string) => { file: unknown } | null;
    closeArchiveApplyWarningDialog: () => void;
    runApplySandboxFile: (file: ChatFileRecord, relativePath?: string | null) => Promise<unknown>;
    addDebugLog: (source: DebugLogEntry['source'], level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
    openRenamePromptDialog: (promptId: string, initialValue: string) => void;
    deletePrompt: (promptId: string) => Promise<void>;
    openLocalChatInChatGpt: (projectId: string, chatId: string, chatUrl: string) => void;
    toggleNewFilesCollapsed: () => void;
    getLatestEntries: () => Array<{ project: SidebarProject; file: ChatFileRecord }>;
    runApplyAllNewFiles: (entries: Array<{ project: SidebarProject; file: ChatFileRecord }>) => Promise<void>;
    findLatestEntryByKey: (fileKey: string) => { project: SidebarProject; file: ChatFileRecord } | null;
    getRemoteFileRootKey: (file: ChatFileRecord) => string;
    getRemoteFileArchiveBranchKey: (file: ChatFileRecord, relativePath: string) => string;
    loadArchiveEntriesForFile: (file: ChatFileRecord) => Promise<void>;
    sendBrowserFileCommand: (command: 'enqueue-file-download' | 'enqueue-file-download-again' | 'cancel-file-download', file: ChatFileRecord) => void;
    shouldWarnBeforeApplyingArchive: (file: ChatFileRecord) => boolean;
    openArchiveApplyWarningDialog: (file: ChatFileRecord, relativePath?: string | null) => void;
    persistDownloadAutomatically: (checked: boolean) => void;
    queueAutomaticSandboxDownloads: () => void;
    getEffectiveDownloadPath: (file: ChatFileRecord) => string | null;
    newIsoTimestamp: () => string;
    findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
    resolveProjectBrowserUrl: (project: SidebarProject) => string;
    resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
    isBrowserPairedWithChat: (projectId: string, chatId: string) => boolean;
    openBrowserForPairedChat: (projectId: string, chatId: string, activateBrowser?: boolean) => boolean;
  };
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
};

export function installComposedRendererBindings(options: RendererBindingsCompositionOptions): void {
  installRendererBindings({
    elements: options.elements,
    sidebarActivityOptions: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      getActiveSidebarTabId: options.state.getActiveSidebarTabId,
      setActiveSidebarTabId: options.state.setActiveSidebarTabId,
      persistActiveSidebarTabId: options.actions.persistActiveSidebarTabId,
      ensureFilesViewLoaded: options.actions.ensureFilesViewLoaded,
      render: options.actions.render,
    },
    localFilesOptions: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      openFolder: (folderPath) => options.desktopPoc.openFolder(folderPath),
      refreshLocalProjectTree: options.actions.refreshLocalProjectTree,
      getCurrentState: options.state.getCurrentState,
      renderFileViewPanel: options.actions.renderFileViewPanel,
      projectBundleCreateInFlightIds: options.projectBundleCreateInFlightIds,
      projectBundleErrorsByProjectId: options.projectBundleErrorsByProjectId,
      createProjectBundle: (projectId) => options.desktopPoc.createProjectBundle(projectId),
      expandedLocalDirectoryKeys: options.expandedLocalDirectoryKeys,
      getLocalFileTreeKey: options.actions.getLocalFileTreeKey,
      localFileEntriesByKey: options.localFileEntriesByKey,
      loadLocalFileTree: options.actions.loadLocalFileTree,
      startFileDrag: (fullPath) => {
        options.desktopPoc.startFileDrag(fullPath);
      },
    },
    promptEventsHelpers: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      openCreatePromptDialog: options.actions.openCreatePromptDialog,
      openPromptsFolder: () => {
        void options.desktopPoc.openPromptsFolder();
      },
      setActivePromptMenu: options.actions.setActivePromptMenu,
      openPromptTab: options.actions.openPromptTab,
      showPromptError: options.actions.showPromptError,
      findPromptEditorTab: options.actions.findPromptEditorTab,
      getCachedPromptContent: (promptId) => options.promptContentCache.get(promptId),
      enterPromptEditMode: options.actions.enterPromptEditMode,
      savePromptTab: options.actions.savePromptTab,
      cancelPromptEditing: options.actions.cancelPromptEditing,
    },
    normalizeBrowserAddress: options.browserController.normalizeAddress,
    openBrowserUrl: options.browserController.openUrl,
    editorTabsHelpers: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      closeEditorTab: options.actions.closeEditorTab,
      activatePairedEditorView: options.actions.activatePairedEditorView,
      activateEditorTab: options.actions.activateEditorTab,
    },
    bottomPanelOptions: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      toggleBottomPanel: options.state.toggleBottomPanel,
      copyVisibleDebugLogs: options.actions.copyVisibleDebugLogs,
      clearDebugLogs: options.actions.clearDebugLogs,
      openEmbeddedTerminal: options.actions.openEmbeddedTerminal,
      closeTerminalSession: options.actions.closeTerminalSession,
      switchBottomTab: options.actions.switchBottomTab,
      setDebugFilterText: options.state.setDebugFilterText,
      setDebugRetentionLimit: (value) => {
        options.state.setDebugRetentionLimit(value);
        options.localStorage.setItem(options.constants.debugRetentionStorageKey, String(value));
      },
      renderDebugLogs: options.actions.renderDebugLogs,
      alert: options.alert,
    },
    gitPanelOptions: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      getGitPanelProjectId: options.state.getGitPanelProjectId,
      getSelectedRefName: options.state.getSelectedGitRefName,
      setSelectedBranchName: options.state.setSelectedGitBranchName,
      getSelectedCommitHash: options.state.getSelectedGitCommitHash,
      setSelectedCommitHash: options.state.setSelectedGitCommitHash,
      clearCommitDetailsState: options.state.clearGitCommitDetailsState,
      refreshGitPanel: options.actions.refreshGitPanel,
      renderBottomPanel: options.actions.renderBottomPanel,
      setGitPanelLoadError: options.state.setGitPanelLoadError,
      renderGitPanel: options.actions.renderGitPanel,
      refreshGitCommitDetails: options.actions.refreshGitCommitDetails,
      getGitCommitDirectoryKey: options.actions.getGitCommitDirectoryKey,
      collapsedGitCommitDirectoryKeys: options.collapsedGitCommitDirectoryKeys,
    },
    projectTreeOptions: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      clearActiveTreeMenuCloseTimer: options.actions.clearActiveTreeMenuCloseTimer,
      scheduleActiveTreeMenuClose: options.actions.scheduleActiveTreeMenuClose,
      getActiveTreeMenu: options.state.getActiveTreeMenu,
      setActiveTreeMenu: options.state.setActiveTreeMenu,
      getTreeMenuKey: (state) => {
        if (!state) {
          return '';
        }
        return state.kind === 'chat' ? `${state.kind}:${state.projectId}:${state.chatId}` : `${state.kind}:${state.projectId}:`;
      },
      render: options.actions.render,
      openProjectFolder: (folderPath) => options.desktopPoc.openFolder(folderPath),
      setPropertiesDialogProject: options.state.setPropertiesDialogProject,
      setPropertiesDialogChat: options.state.setPropertiesDialogChat,
      setSelectedSidebarItem: options.state.setSelectedSidebarItem,
      expandedProjectIds: options.expandedProjectIds,
      persistExpandedProjectIds: options.actions.persistExpandedProjectIds,
      getCurrentState: options.state.getCurrentState,
      findSidebarProject: options.actions.findSidebarProject,
      findSidebarChat: options.actions.findSidebarChat,
      setBrowserOpenedSidebarItem: options.state.setBrowserOpenedSidebarItem,
      persistBrowserOpenedSelection: options.state.persistBrowserOpenedSelection,
      openBrowserUrl: (url) => {
        options.browserController.openUrl(url);
      },
      resolveProjectBrowserUrl: options.actions.resolveProjectBrowserUrl,
      resolveChatBrowserUrl: options.actions.resolveChatBrowserUrl,
      openChatHistoryTab: options.actions.openChatHistoryTab,
      getChatEditorTabId: options.actions.getChatEditorTabId,
      hasEditorTab: options.actions.hasEditorTab,
      closeEditorTab: options.actions.closeEditorTab,
      removeChat: (projectId, chatId) => options.desktopPoc.removeChat(projectId, chatId),
      connectProject: (projectId) => options.desktopPoc.connectProject(projectId),
      removeProject: (projectId) => options.desktopPoc.removeProject(projectId),
      confirm: options.confirm,
      alert: options.alert,
    },
    overlayOptions: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      submitPromptNameDialog: options.actions.submitPromptNameDialog,
      cancelPromptNameDialog: options.actions.closePromptNameDialog,
      isPromptNameDialogOpen: options.state.isPromptNameDialogOpen,
      getRemoteManifestPrompt: options.actions.getRemoteManifestPrompt,
      getEffectiveProjectId: options.actions.getEffectiveProjectId,
      writeClipboardText: options.actions.writeClipboardText,
      showRemoteFilesNotice: options.actions.showRemoteFilesNotice,
      findLatestNewFileByKey: options.actions.findLatestNewFileByKey,
      closeArchiveApplyWarningDialog: options.actions.closeArchiveApplyWarningDialog,
      runApplySandboxFile: (file, relativePath) => options.actions.runApplySandboxFile(file as ChatFileRecord, relativePath),
      addDebugLog: options.actions.addDebugLog,
      isArchiveApplyWarningOpen: options.state.isArchiveApplyWarningOpen,
      closePropertiesDialog: options.state.closePropertiesDialog,
      isPropertiesDialogOpen: options.state.isPropertiesDialogOpen,
      isActiveTreeMenuOpen: options.state.isActiveTreeMenuOpen,
      closeActiveTreeMenu: options.state.closeActiveTreeMenu,
      isActivePromptMenuOpen: options.state.isActivePromptMenuOpen,
      closeActivePromptMenu: options.state.closeActivePromptMenu,
      openPromptTab: options.actions.openPromptTab,
      getPromptById: options.state.getPromptById,
      openRenamePromptDialog: options.actions.openRenamePromptDialog,
      confirm: options.confirm,
      deletePrompt: options.actions.deletePrompt,
      alert: options.alert,
      render: options.actions.render,
    },
    chatHistoryHelpers: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      showItemInFolder: (filePath) => options.desktopPoc.showItemInFolder(filePath),
      openLocalChatInChatGpt: options.actions.openLocalChatInChatGpt,
    },
    remoteFilesOptions: {
      findClosestHtmlElement: options.actions.findClosestHtmlElement,
      toggleCollapsed: options.actions.toggleNewFilesCollapsed,
      getLatestEntries: options.actions.getLatestEntries,
      render: options.actions.render,
      runApplyAllNewFiles: options.actions.runApplyAllNewFiles,
      findLatestEntryByKey: options.actions.findLatestEntryByKey,
      getRootKey: options.actions.getRemoteFileRootKey,
      getBranchKey: options.actions.getRemoteFileArchiveBranchKey,
      expandedKeys: options.expandedNewFilesKeys,
      archiveEntriesByFileKey: options.archiveEntriesByFileKey,
      fileDownloadStatuses: options.fileDownloadStatuses,
      loadArchiveEntriesForFile: options.actions.loadArchiveEntriesForFile,
      sendBrowserFileCommand: options.actions.sendBrowserFileCommand,
      shouldWarnBeforeApplyingArchive: options.actions.shouldWarnBeforeApplyingArchive,
      openArchiveApplyWarningDialog: options.actions.openArchiveApplyWarningDialog,
      runApplySandboxFile: options.actions.runApplySandboxFile,
      showRemoteFilesNotice: options.actions.showRemoteFilesNotice,
      addDebugLog: options.actions.addDebugLog,
      setDownloadAutomatically: options.state.setDownloadAutomatically,
      persistDownloadAutomatically: (checked) => {
        options.actions.persistDownloadAutomatically(checked);
        options.localStorage.setItem(options.constants.downloadAutomaticallyStorageKey, String(checked));
      },
      queueAutomaticSandboxDownloads: options.actions.queueAutomaticSandboxDownloads,
      getEffectiveDownloadPath: options.actions.getEffectiveDownloadPath,
      showItemInFolder: (filePath) => options.desktopPoc.showItemInFolder(filePath),
      newIsoTimestamp: options.actions.newIsoTimestamp,
    },
  });
}
