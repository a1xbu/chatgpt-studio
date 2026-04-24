import {
  type BottomPanelRuntimeState,
} from '../bottom-panel/runtime';
import { renderEditorArea as renderEditorAreaImpl, renderEditorTabs as renderEditorTabsImpl } from '../editor/view';
import {
  findChatEditorTab as findChatEditorTabInTabs,
  findPromptEditorTab as findPromptEditorTabInTabs,
  getChatEditorTabId as getChatEditorTabIdImpl,
  getPromptEditorTabId as getPromptEditorTabIdImpl,
  normalizeEditorTabsState as normalizeEditorTabsStateImpl,
  resolveSelectionForActiveEditorTab as resolveSelectionForActiveEditorTabImpl,
  updateEditorTabBarLayout as updateEditorTabBarLayoutImpl,
} from '../editor/controller';
import {
  type EditorRuntimeState,
} from '../editor/runtime';
import {
  loadChatHistoryIntoTab as loadChatHistoryIntoTabImpl,
} from '../chat/controller';
import { createChatHistoryEmptyState as createChatHistoryEmptyStateImpl, createChatHistoryTabContent as createChatHistoryTabContentImpl, countReasoningBlocks } from '../chat/history';
import { formatChatMessageRole, formatChatMessageTimestamp, wrapTextAsMarkdownCodeFence } from '../chat/format';
import { createPromptEditorContent as createPromptEditorContentImpl, getPromptEditorStatusText } from '../prompts/editor';
import {
  type DebugRuntimeState,
} from '../debug/runtime';
import { classifyLocalFileActivity, formatTreeTimestamp } from '../files/activity';
import {
  getAllSidebarFiles,
  getChatFileKey,
  getLatestNewFiles,
  getSandboxFileBaseName,
} from '../files/discovery';
import {
  formatUpdatedFilesMessage,
  isZipLikeRemoteFile,
  renderRemoteFilesPanelMarkup,
} from '../remote-files/panel';
import {
  buildChatBrowserUrl,
  findKnownProjectUrl,
  normalizeStoredUrl,
  resolveChatBrowserUrl,
  resolveProjectBrowserUrl,
} from '../browser/urls';
import {
  loadInitialNewFilesHeight,
} from '../sidebar/storage';

import {
  type BrowserNavigationState,
} from '../browser/navigation';
import { createBrowserController } from '../browser/controller';
import {
  getRemoteManifestPrompt as getRemoteManifestPromptImpl,
  shouldWarnBeforeApplyingArchive as shouldWarnBeforeApplyingArchiveImpl,
} from '../files/runtime';
import {
  type GitRuntimeState,
} from '../git/runtime';
import { createRendererBindingsAssemblyContext, createRendererBootstrapAssemblyContext } from '../bootstrap/renderer-context';
import { installRendererFeatureBindings, runRendererBootstrapAssembly } from '../bootstrap/install';
import { findPersistentSidebarProject, findSidebarChat, findSidebarProject, getAllSidebarProjects } from '../sidebar/queries';
import {
  startDrag as startDragImpl,
} from '../layout/resizers';
import {
  renderAddIcon,
  renderApplyIcon,
  renderArchiveIcon,
  renderBrowserTabIcon,
  renderBusyIcon,
  renderCancelIcon,
  renderChatIcon,
  renderCheckIcon,
  renderChevronIcon,
  renderCloseIcon,
  renderDownloadArrowIcon,
  renderFileTreeFileIcon,
  renderFolderTreeIcon,
  renderGitBranchIcon,
  renderMoreActionsIcon,
  renderOpenFolderIcon,
  renderOpenInBrowserIcon,
  renderProjectIcon,
  renderPromptIcon,
  renderRefreshIcon,
  renderSpinnerIcon,
  renderGenericFileIcon,
} from '../ui/icons';
import { createRendererSidebarHost } from '../sidebar/host';
import { createRendererWorkbenchHost } from '../workbench/host';
import type { FileDownloadRuntimeStatus, MarkdownItInstance, WebviewElement, XtermFitAddon, XtermTerminal } from '../runtime-types';
import type { BootstrapPayload, LocalProjectFileEntry, PromptDirectorySnapshot, TerminalSessionState } from '../desktop-api';
import type { BrowserEditorTab, EditorTabState, PromptEditorTab } from '../editor/types';
import type { GitCommitDetails, GitRepositoryOverview } from '../git/types';
import {
  createRendererContext,
  type RendererContext,
} from '../app/context';
import { createRendererStateAccess } from '../app/state-access';
import { createRendererFeatureRegistry } from '../app/feature-registry';
import { createRendererEditorFeatureBaseOptions } from '../editor/shell-runtime';
import { createRendererBrowserBindingsSlice, createRendererBrowserFeatureBaseOptions } from '../browser/shell-runtime';
import { createRendererPromptsFeatureBaseOptions } from '../prompts/shell-runtime';
import {
  createRendererBottomPanelBindingsSlice,
  createRendererBottomPanelBootstrapSlice,
  createRendererBottomPanelFeatureBaseOptions,
} from '../bottom-panel/shell-runtime';
import { createRendererRemoteFilesBindingsSlice } from '../remote-files/shell-runtime';
import { createRendererRemoteFilesRuntime } from '../remote-files/runtime';
import { createRendererSidebarFeatureOptions } from '../sidebar/shell-runtime';
import { createRendererFilesFeatureOptions } from '../files/shell-runtime';
import { rendererShellConfig } from '../app/shell-config';
import { createRendererAppServices } from '../app/services';
import { createRendererStore } from '../app/store';
import { createRendererUiRefs } from '../app/ui-refs';
import { escapeHtml, findClosestHtmlElement, formatFileSize, formatTimestamp } from '../app/utils';
import type {
  AppStateSnapshot,
  ApplySandboxFileResult,
  ArchiveEntryComparisonStatus,
  ChatFileArchiveEntryRecord,
  ChatFileRecord,
  ChatHistoryRecord,
  ChatPageContext,
  DebugLogEntry,
  ProjectBundleRecord,
  PromptRecord,
  SidebarProject,
} from '../../shared/contracts';

export type RendererApp = {
  bootstrap: () => Promise<void>;
};

export function createRendererApp(): RendererApp {
  const {
    editor: {
      maxOpenChatTabs: MAX_OPEN_CHAT_TABS,
      maxOpenPromptTabs: MAX_OPEN_PROMPT_TABS,
      tabBaseWidthPx: EDITOR_TAB_BASE_WIDTH_PX,
      tabMinWidthPx: EDITOR_TAB_MIN_WIDTH_PX,
    },
    storage: {
      sidebarWidthKey: SIDEBAR_WIDTH_STORAGE_KEY,
      sidebarDetailsHeightKey: SIDEBAR_DETAILS_HEIGHT_STORAGE_KEY,
      sidebarDetailsCollapsedKey: SIDEBAR_DETAILS_COLLAPSED_STORAGE_KEY,
      debugHeightKey: DEBUG_HEIGHT_STORAGE_KEY,
      debugCollapsedKey: DEBUG_COLLAPSED_STORAGE_KEY,
      debugRetentionKey: DEBUG_RETENTION_STORAGE_KEY,
      projectTreeExpandedKey: PROJECT_TREE_EXPANDED_STORAGE_KEY,
      sidebarSelectionKey: SIDEBAR_SELECTION_STORAGE_KEY,
      sidebarActiveTabKey: SIDEBAR_ACTIVE_TAB_STORAGE_KEY,
      newFilesCollapsedKey: NEW_FILES_COLLAPSED_STORAGE_KEY,
      newFilesHeightKey: NEW_FILES_HEIGHT_STORAGE_KEY,
      downloadAutomaticallyKey: DOWNLOAD_AUTOMATICALLY_STORAGE_KEY,
      lastBrowserOpenedKey: LAST_BROWSER_OPENED_STORAGE_KEY,
      lastActiveLocalChatKey: LAST_ACTIVE_LOCAL_CHAT_STORAGE_KEY,
    },
    layout: {
      minSidebarWidth: MIN_SIDEBAR_WIDTH,
      maxSidebarWidth: MAX_SIDEBAR_WIDTH,
      minSidebarDetailsHeight: MIN_SIDEBAR_DETAILS_HEIGHT,
      minDebugPanelHeight: MIN_DEBUG_PANEL_HEIGHT,
      minNewFilesPanelHeight: MIN_NEW_FILES_PANEL_HEIGHT,
      maxDebugPanelHeight: MAX_DEBUG_PANEL_HEIGHT,
    },
    debug: {
      maxLogs: MAX_DEBUG_LOGS,
    },
    files: {
      recentFileActivityWindowMs: RECENT_FILE_ACTIVITY_WINDOW_MS,
      remoteManifestFile: REMOTE_MANIFEST_FILE,
      remoteMetaDirectory: REMOTE_META_DIRECTORY,
      remoteManifestPrompt: REMOTE_MANIFEST_PROMPT,
    },
  } = rendererShellConfig;

  const rendererUiRefs = createRendererUiRefs(document);
  const {
    projectListElement,
    newFilesPanelElement,
    fileViewPanelElement,
    promptViewPanelElement,
    sidebarActivityElement,
    sidebarPanelExplorerElement,
    sidebarPanelFilesElement,
    sidebarPanelPromptsElement,
    sidebarContentElement,
    newFilesPanelResizerElement,
    sidebarElement,
    sidebarDetailsElement,
    sidebarDetailsResizerElement,
    editorTabsElement,
    browserToolbarElement,
    browserToolbarControlsElement,
    backButton,
    forwardButton,
    refreshStopButton,
    browserAddressFormElement,
    toggleBottomPanelButton,
    clearDebugButton,
    copyDebugButton,
    openTerminalButton,
    bottomTabsElement,
    browserUrlElement,
    browserViewElement,
    browserElement,
    chatHistoryViewElement,
    promptEditorViewElement,
    appShellElement,
    debugConsoleElement,
    debugFilterInputElement,
    debugRetentionElement,
    debugViewElement,
    terminalViewElement,
    terminalPaneElement,
    terminalEmptyElement,
    terminalMetaElement,
    terminalHostElement,
    gitViewElement,
    sidebarResizerElement,
    bottomPanelResizerElement,
    dragShieldElement,
    workbenchElement,
    overlayRootElement,
  } = rendererUiRefs;

  const rendererDesktopPoc = window.desktopPoc;
  const rendererStorage = window.localStorage;

  const rendererStore = createRendererStore({
    storage: rendererStorage,
  });
  const {
    app: appState,
    workspace: workspaceState,
    files: filesState,
    remoteFiles: remoteFilesState,
    browser: browserState,
    menus: menuState,
    dialogs: dialogState,
    editor: editorState,
    bottomPanel: bottomPanelState,
  } = rendererStore;

  const markdownRenderer = markdownit({
    breaks: true,
    html: false,
    linkify: true,
    typographer: true,
  });

  let workbenchHost: ReturnType<typeof createRendererWorkbenchHost> | null = null;
  let workbenchBrowserControllerHooks: {
    activateBrowserTab: () => void;
    renderActivatedView: () => void;
  } | null = null;

  const browserController = createBrowserController(
    () => rendererStore.getBrowserNavigationState(),
    (nextState: BrowserNavigationState) => {
      rendererStore.setBrowserNavigationState(nextState);
    },
    {
      browserElement,
      browserUrlElement,
      backButton,
      forwardButton,
      refreshStopButton,
    },
    {
      normalizeStoredUrl,
      onActivate: () => {
        if (workbenchBrowserControllerHooks) {
          workbenchBrowserControllerHooks.activateBrowserTab();
          return;
        }

        editorState.activeEditorTabId = 'browser';
      },
      onRenderActivatedView: () => {
        if (workbenchBrowserControllerHooks) {
          workbenchBrowserControllerHooks.renderActivatedView();
          return;
        }

        renderEditorArea();
      },
      setTimeoutImpl: window.setTimeout.bind(window),
    },
  );

  const rendererServices = createRendererAppServices({
    windowLike: window,
    desktopPoc: rendererDesktopPoc,
    browserController,
    clipboard: navigator.clipboard,
    storage: rendererStorage,
  });

  let rendererFeatures: ReturnType<typeof createRendererFeatureRegistry>;

  const sidebarHost = createRendererSidebarHost({
    sidebarUiRuntime: {
      workspaceState,
      filesState,
      storage: rendererStorage,
      storageKeys: {
        projectTreeExpanded: PROJECT_TREE_EXPANDED_STORAGE_KEY,
        sidebarSelection: SIDEBAR_SELECTION_STORAGE_KEY,
        sidebarActiveTab: SIDEBAR_ACTIVE_TAB_STORAGE_KEY,
        sidebarWidth: SIDEBAR_WIDTH_STORAGE_KEY,
        sidebarDetailsHeight: SIDEBAR_DETAILS_HEIGHT_STORAGE_KEY,
        newFilesHeight: NEW_FILES_HEIGHT_STORAGE_KEY,
        newFilesCollapsed: NEW_FILES_COLLAPSED_STORAGE_KEY,
      },
      elements: {
        documentElement: document.documentElement,
        appShellElement,
        sidebarElement,
        sidebarContentElement,
        sidebarActivityElement,
        sidebarPanelExplorerElement,
        sidebarPanelFilesElement,
        sidebarPanelPromptsElement,
        sidebarDetailsElement,
        sidebarResizerElement,
        sidebarDetailsResizerElement,
        newFilesPanelElement,
        newFilesPanelResizerElement,
        dragShieldElement,
      },
      layout: {
        minSidebarWidth: MIN_SIDEBAR_WIDTH,
        maxSidebarWidth: MAX_SIDEBAR_WIDTH,
        minSidebarDetailsHeight: MIN_SIDEBAR_DETAILS_HEIGHT,
        minNewFilesPanelHeight: MIN_NEW_FILES_PANEL_HEIGHT,
        startDrag,
      },
      helpers: {
        loadInitialNewFilesHeight: () => loadInitialNewFilesHeight(rendererStorage, NEW_FILES_HEIGHT_STORAGE_KEY),
        findSidebarProject,
        findSidebarChat,
        findKnownProjectUrl,
        normalizeStoredUrl,
        escapeHtml,
        formatTimestamp,
        renderChevronIcon,
        syncSidebarSelection: (state) => rendererFeatures.sidebar().actions.syncSidebarSelection(state),
      },
    },
    getContext: getRendererContext,
  });

  const sidebarBootstrapSlice = sidebarHost.createBootstrapSlice();
  const sidebarBindingsSlice = sidebarHost.createBindingsSlice();

  const remoteFilesRuntime = createRendererRemoteFilesRuntime({
    appState,
    workspaceState,
    filesState,
    remoteFilesState,
    getAllSidebarProjects,
    getAllProjectsForRefresh: getAllSidebarProjects,
    render,
    desktopApi: {
      listSandboxFileArchiveEntries: (projectId, chatId, messageId, sandboxPath) => (
        rendererDesktopPoc.listSandboxFileArchiveEntries(projectId, chatId, messageId, sandboxPath)
      ),
      applySandboxFile: (projectId, chatId, messageId, sandboxPath, relativePath) => (
        rendererDesktopPoc.applySandboxFile(projectId, chatId, messageId, sandboxPath, relativePath)
      ),
    },
    timers: {
      setTimeout: rendererServices.timers.setTimeout,
      clearTimeout: rendererServices.timers.clearTimeout,
    },
    refreshLocalProjectTree: (projectId) => rendererFeatures.files().actions.refreshLocalProjectTree(projectId),
  });

  const editorFeatureBaseOptions = createRendererEditorFeatureBaseOptions({
    limits: {
      maxOpenChatTabs: MAX_OPEN_CHAT_TABS,
      maxOpenPromptTabs: MAX_OPEN_PROMPT_TABS,
      editorTabBaseWidthPx: EDITOR_TAB_BASE_WIDTH_PX,
      editorTabMinWidthPx: EDITOR_TAB_MIN_WIDTH_PX,
    },
    appState,
    workspaceState,
    browserState,
    editorState,
    store: rendererStore,
    desktopPoc: rendererDesktopPoc,
    storage: rendererStorage,
    storageKeys: {
      lastActiveLocalChat: LAST_ACTIVE_LOCAL_CHAT_STORAGE_KEY,
    },
    setSelectedSidebarItem: sidebarHost.setSelectedSidebarItem,
    getPairedChatEditorTab: () => rendererFeatures.editor().selectors.getPairedChatEditorTab(),
    renderApp: renderEditorShell,
    renderEditorArea,
    addDebugLog,
    queries: {
      findSidebarProject,
      findPersistentSidebarProject,
      findSidebarChat,
      resolveChatBrowserUrl,
      buildChatBrowserUrl,
    },
    markdownRenderer,
    formatters: {
      escapeHtml,
      formatTimestamp,
      formatTreeTimestamp,
      formatFileSize,
    },
    icons: {
      renderBrowserTabIcon,
      renderChatIcon,
      renderPromptIcon,
      renderCloseIcon,
      renderGenericFileIcon,
    },
    elements: {
      editorTabsElement,
      promptViewPanelElement,
      promptEditorViewElement,
      workbenchElement,
      browserToolbarElement,
      browserToolbarControlsElement,
      browserAddressFormElement,
      browserViewElement,
      chatHistoryViewElement,
      browserElement,
    },
  });

  workbenchHost = createRendererWorkbenchHost({
    appState,
    editorState,
    persistActiveLocalChatSelection: editorFeatureBaseOptions.persistActiveLocalChatSelection,
    getFeatures: () => rendererFeatures,
  });
  const mainWorkbenchHost = workbenchHost;
  workbenchBrowserControllerHooks = mainWorkbenchHost.createBrowserControllerHooks();
  const workbenchContextRenderHooks = mainWorkbenchHost.createContextRenderHooks();
  const workbenchBootstrapSlice = mainWorkbenchHost.createBootstrapSlice();
  const workbenchBindingsSlice = mainWorkbenchHost.createBindingsSlice();

  let rendererContext: RendererContext | null = null;

  function getRendererContext(): RendererContext {
    if (rendererContext) {
      return rendererContext;
    }

    rendererContext = createRendererContext({
      services: rendererServices,
      state: createRendererStateAccess({
        app: {
          getCurrentState: () => appState.currentState,
        },
        treeMenu: {
          getActiveMenu: () => menuState.activeTreeMenu,
          setActiveMenu: (value) => {
            menuState.activeTreeMenu = value;
          },
          getCloseTimer: () => menuState.activeTreeMenuCloseTimer,
          setCloseTimer: (value) => {
            menuState.activeTreeMenuCloseTimer = value;
          },
        },
        editor: {
          getRuntimeState: rendererStore.getEditorRuntimeState,
          setRuntimeState: rendererStore.setEditorRuntimeState,
        },
        bottomPanel: {
          getRuntimeState: rendererStore.getBottomPanelRuntimeState,
          setRuntimeState: rendererStore.setBottomPanelRuntimeState,
        },
      }),
      renderHooks: {
        render,
        ...workbenchContextRenderHooks,
        renderBottomPanel: () => rendererFeatures.bottomPanel().render.bottomPanel(),
        applyDebugPanelState,
        scheduleTerminalFit: () => rendererFeatures.bottomPanel().actions.scheduleTerminalFit(),
        syncActiveTerminalViewport: (force) => rendererFeatures.bottomPanel().actions.syncActiveTerminalViewport(force),
      },
    });

    return rendererContext;
  }


  rendererFeatures = createRendererFeatureRegistry({
    sidebar: createRendererSidebarFeatureOptions({
      appState,
      workspaceState,
      remoteFilesState,
      storage: rendererStorage,
      storageKeys: {
        sidebarSelection: SIDEBAR_SELECTION_STORAGE_KEY,
        newFilesCollapsed: NEW_FILES_COLLAPSED_STORAGE_KEY,
      },
      elements: {
        projectListElement,
        newFilesPanelElement,
        newFilesPanelResizerElement,
      },
      sidebarHost,
      remoteFilesRuntime: remoteFilesRuntime,
      queries: {
        getAllSidebarProjects,
        getLatestNewFiles,
        findPersistentSidebarProject,
        findSidebarProject,
        findSidebarChat,
        getChatFileKey,
        getSandboxFileBaseName,
      },
      formatters: {
        escapeHtml,
        formatTimestamp,
      },
      icons: {
        renderChevronIcon,
        renderProjectIcon,
        renderChatIcon,
        renderMoreActionsIcon,
        renderOpenInBrowserIcon,
        renderFolderTreeIcon,
        renderFileTreeFileIcon,
        renderArchiveIcon,
        renderGitBranchIcon,
        renderApplyIcon,
        renderBusyIcon,
        renderCheckIcon,
        renderDownloadArrowIcon,
      },
    }),
    files: createRendererFilesFeatureOptions({
      appState,
      workspaceState,
      filesState,
      remoteFilesState,
      desktopApi: rendererDesktopPoc,
      elements: {
        fileViewPanelElement,
      },
      sidebarHost,
      queries: {
        getAllSidebarProjects,
        findPersistentSidebarProject,
        findSidebarProject,
      },
      formatters: {
        escapeHtml,
        formatTimestamp,
        formatFileSize,
      },
      icons: {
        renderArchiveIcon,
        renderSpinnerIcon,
        renderOpenFolderIcon,
        renderRefreshIcon,
        renderFolderTreeIcon,
        renderFileTreeFileIcon,
      },
      classifyActivity: (entry) => classifyLocalFileActivity(entry, RECENT_FILE_ACTIVITY_WINDOW_MS),
    }),
    prompts: createRendererPromptsFeatureBaseOptions({
      appState,
      dialogState,
      editorState,
      store: rendererStore,
      desktopPoc: rendererDesktopPoc,
      renderApp: render,
      elements: {
        promptViewPanelElement,
        overlayRootElement,
      },
      environment: {
        documentLike: document,
        bodyElement: document.body,
        windowLike: window,
      },
      remoteManifestFile: REMOTE_MANIFEST_FILE,
      helpers: {
        getChatFileKey,
        findLatestNewFileByKey,
        getRemoteManifestPrompt,
        findSidebarProject,
        findSidebarChat,
        formatTimestamp,
        escapeHtml,
        renderOpenFolderIcon,
        renderFileTreeFileIcon,
        renderSharedFileTreeItem: sidebarHost.renderSharedFileTreeItem,
        renderSharedFileTreeActionButton: sidebarHost.renderSharedFileTreeActionButton,
        renderMoreActionsIcon,
      },
      timers: {
        setTimeoutImpl: rendererServices.timers.setTimeout,
        clearTimeoutImpl: rendererServices.timers.clearTimeout,
      },
    }),
    editor: editorFeatureBaseOptions,
    browser: createRendererBrowserFeatureBaseOptions({
      appState,
      workspaceState,
      remoteFilesState,
      browserState,
      workbenchHost: mainWorkbenchHost,
      store: rendererStore,
      storage: rendererStorage,
      storageKeys: {
        browserOpened: LAST_BROWSER_OPENED_STORAGE_KEY,
        lastActiveLocalChat: LAST_ACTIVE_LOCAL_CHAT_STORAGE_KEY,
      },
      setSelectedSidebarItem: sidebarHost.setSelectedSidebarItem,
      browserController,
      browserElement,
      renderApp: render,
      renderEditorArea: workbenchContextRenderHooks.renderEditorArea,
      queries: {
        findSidebarProject,
        findPersistentSidebarProject,
        findSidebarChat,
        getAllSidebarProjects,
        getLatestNewFiles,
        getChatFileKey,
        resolveChatBrowserUrl,
        resolveProjectBrowserUrl,
      },
    }),
    bottomPanel: createRendererBottomPanelFeatureBaseOptions({
      appState,
      bottomPanelState,
      store: rendererStore,
      renderApp: render,
      elements: {
        appShellElement,
        workbenchElement,
        toggleBottomPanelButton,
        bottomPanelResizerElement,
        bottomTabsElement,
        debugConsoleElement,
        debugRetentionElement,
        debugViewElement,
        terminalViewElement,
        gitViewElement,
        terminalPaneElement,
        terminalEmptyElement,
        terminalMetaElement,
        terminalHostElement,
      },
      storage: {
        localStorage: rendererStorage,
        debugCollapsedStorageKey: DEBUG_COLLAPSED_STORAGE_KEY,
        debugHeightStorageKey: DEBUG_HEIGHT_STORAGE_KEY,
      },
      limits: {
        maxDebugLogs: MAX_DEBUG_LOGS,
        minDebugPanelHeight: MIN_DEBUG_PANEL_HEIGHT,
        maxDebugPanelHeight: MAX_DEBUG_PANEL_HEIGHT,
      },
      services: {
        timers: rendererServices.timers,
        clipboard: rendererServices.clipboard,
        documentLike: document,
      },
      desktopApi: rendererDesktopPoc,
      layout: {
        startDrag,
      },
      formatters: {
        escapeHtml,
        formatTimestamp,
      },
      icons: {
        renderChevronIcon,
        renderFolderTreeIcon,
        renderFileTreeFileIcon,
        renderRefreshIcon,
      },
    }),
  });


  const browserBindingsSlice = createRendererBrowserBindingsSlice({
    browserState,
    getFeature: () => rendererFeatures.browser(),
    resolveProjectBrowserUrl,
    resolveChatBrowserUrl,
  });

  const remoteFilesBindingsSlice = createRendererRemoteFilesBindingsSlice({
    workspaceState,
    remoteFilesState,
    storage: rendererStorage,
    storageKeys: {
      newFilesCollapsed: NEW_FILES_COLLAPSED_STORAGE_KEY,
      downloadAutomatically: DOWNLOAD_AUTOMATICALLY_STORAGE_KEY,
    },
    remoteFilesRuntime: remoteFilesRuntime,
    getLatestEntries: () => rendererFeatures.sidebar().selectors.getLatestEntriesForCurrentState(),
    findLatestNewFileByKey: (fileKey) => rendererFeatures.sidebar().selectors.findLatestNewFileByKey(fileKey),
    getChatFileKey,
    shouldWarnBeforeApplyingArchive: shouldWarnBeforeApplyingArchiveImpl,
    createIsoTimestamp: () => new Date().toISOString(),
  });

  const bottomPanelBootstrapSlice = createRendererBottomPanelBootstrapSlice({
    bottomPanelState,
    getFeature: () => rendererFeatures.bottomPanel(),
  });

  const bottomPanelBindingsSlice = createRendererBottomPanelBindingsSlice({
    bottomPanelState,
    getFeature: () => rendererFeatures.bottomPanel(),
  });

  function syncGitPanelWithCurrentProject(): void {
    rendererFeatures.bottomPanel().actions.syncGitPanelWithCurrentProject();
  }

  function findLatestNewFileByKey(fileKey: string): { project: SidebarProject; file: ChatFileRecord } | null {
    return rendererFeatures.sidebar().selectors.findLatestNewFileByKey(fileKey);
  }

  function getRemoteManifestPrompt(projectId: string): string {
    return getRemoteManifestPromptImpl(REMOTE_MANIFEST_PROMPT, projectId);
  }

  function renderEditorArea(): void {
    rendererFeatures.editor().render.area();
  }

  let lastRenderedEditorShellProjectId: string | null = null;

  function renderEditorShell(forceProjectPanels = false): void {
    if (!appState.currentState || !projectListElement) {
      return;
    }

    rendererFeatures.sidebar().render.sidebar();

    const nextProjectId = workspaceState.selectedSidebarItem?.projectId ?? null;
    if (workspaceState.activeSidebarTabId === 'files') {
      rendererFeatures.files().actions.ensureLocalFileTreeForState(appState.currentState);
    }
    if (forceProjectPanels || nextProjectId !== lastRenderedEditorShellProjectId || workspaceState.activeSidebarTabId === 'files') {
      rendererFeatures.files().render.fileViewPanel(appState.currentState, true);
      lastRenderedEditorShellProjectId = nextProjectId;
    }

    sidebarHost.renderSidebarDetails(appState.currentState);
    mainWorkbenchHost.renderWorkbench();
  }

  function render(): void {
    if (!appState.currentState || !projectListElement) {
      return;
    }

    renderEditorShell(true);
    syncGitPanelWithCurrentProject();
    rendererFeatures.prompts().render.overlayDialog();
    rendererFeatures.bottomPanel().render.debugLogs();
    rendererFeatures.bottomPanel().render.bottomPanel();
  }

  function pushDebugLog(entry: DebugLogEntry): void {
    rendererFeatures.bottomPanel().actions.pushDebugLog(entry);
  }

  function addDebugLog(
    source: DebugLogEntry['source'],
    level: DebugLogEntry['level'],
    message: string,
    details: string | null = null,
  ): void {
    rendererFeatures.bottomPanel().actions.addDebugLog(source, level, message, details);
  }

  function startDrag(cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void): void {
    startDragImpl(
      {
        appShellElement,
        dragShieldElement,
      },
      cursor,
      onMove,
    );
  }



  function applyDebugPanelState(): void {
    rendererFeatures.bottomPanel().actions.applyDebugPanelState();
  }

  async function bootstrap(): Promise<void> {
    await runRendererBootstrapAssembly(createRendererBootstrapAssemblyContext({
      features: rendererFeatures.composition(),
      elements: {
        browserElement,
        browserUrlElement,
      },
      localStorage: rendererStorage,
      storageKeys: {
        sidebarWidth: SIDEBAR_WIDTH_STORAGE_KEY,
        debugHeight: DEBUG_HEIGHT_STORAGE_KEY,
        debugRetention: DEBUG_RETENTION_STORAGE_KEY,
        sidebarSelection: SIDEBAR_SELECTION_STORAGE_KEY,
        debugCollapsed: DEBUG_COLLAPSED_STORAGE_KEY,
      },
      limits: {
        minSidebarWidth: MIN_SIDEBAR_WIDTH,
        maxSidebarWidth: MAX_SIDEBAR_WIDTH,
        minDebugPanelHeight: MIN_DEBUG_PANEL_HEIGHT,
        maxDebugPanelHeight: MAX_DEBUG_PANEL_HEIGHT,
        maxDebugLogs: MAX_DEBUG_LOGS,
      },
      sidebar: sidebarBootstrapSlice,
      bottomPanel: bottomPanelBootstrapSlice,
      desktopPoc: rendererDesktopPoc,
      state: {
        getCurrentState: () => appState.currentState,
        setCurrentState: (state) => {
          appState.currentState = state;
        },
        setBrowserOpenedSidebarItem: browserBindingsSlice.state.setBrowserOpenedSidebarItem,
        setSelectedSidebarItem: sidebarBindingsSlice.state.setSelectedSidebarItem,
      },
      shell: {
        render,
      },
      browserController,
      fileDownloadStatuses: remoteFilesState.fileDownloadStatuses,
      workbench: workbenchBootstrapSlice,
    }));
  }

  installRendererFeatureBindings(createRendererBindingsAssemblyContext({
    features: rendererFeatures.composition(),
    elements: {
      sidebarActivityElement,
      projectListElement,
      newFilesPanelElement,
      fileViewPanelElement,
      promptViewPanelElement,
      promptEditorViewElement,
      editorTabsElement,
      backButton,
      forwardButton,
      refreshStopButton,
      browserAddressFormElement,
      browserUrlElement,
      browserElement,
      toggleBottomPanelButton,
      copyDebugButton,
      clearDebugButton,
      openTerminalButton,
      bottomTabsElement,
      debugFilterInputElement,
      debugRetentionElement,
      gitViewElement,
      overlayRootElement,
      chatHistoryViewElement,
    },
    localStorage: rendererStorage,
    desktopPoc: rendererDesktopPoc,
    browserController,
    promptContentCache: editorState.promptContentCache,
    prompts: editorState.prompts,
    expandedProjectIds: workspaceState.expandedProjectIds,
    expandedLocalDirectoryKeys: filesState.expandedLocalDirectoryKeys,
    projectBundleCreateInFlightIds: filesState.projectBundleCreateInFlightIds,
    projectBundleErrorsByProjectId: filesState.projectBundleErrorsByProjectId,
    localFileEntriesByKey: filesState.localFileEntriesByKey,
    collapsedGitCommitDirectoryKeys: bottomPanelState.collapsedGitCommitDirectoryKeys,
    archiveEntriesByFileKey: remoteFilesState.archiveEntriesByFileKey,
    expandedNewFilesKeys: remoteFilesState.expandedNewFilesKeys,
    fileDownloadStatuses: remoteFilesState.fileDownloadStatuses,
    constants: {
      activeSidebarTabStorageKey: SIDEBAR_ACTIVE_TAB_STORAGE_KEY,
      debugRetentionStorageKey: DEBUG_RETENTION_STORAGE_KEY,
      downloadAutomaticallyStorageKey: DOWNLOAD_AUTOMATICALLY_STORAGE_KEY,
    },
    state: {
      getCurrentState: () => appState.currentState,
    },
    sidebar: sidebarBindingsSlice,
    browser: browserBindingsSlice,
    remoteFiles: remoteFilesBindingsSlice,
    bottomPanel: bottomPanelBindingsSlice,
    actions: {
      findClosestHtmlElement,
      render,
      renderFileViewPanelStateCast: (state) => state as AppStateSnapshot,
      showPromptError: (message) => {
        window.alert(message);
      },
      getRemoteManifestPrompt,
      getEffectiveProjectId: (requestedProjectId) => requestedProjectId || appState.currentState?.lastContext?.currentProjectId || '',
      writeClipboardText: (text) => rendererServices.clipboard.writeText(text),
      findSidebarProject,
      findSidebarChat,
    },
    alert: (message) => window.alert(message),
    confirm: (message) => window.confirm(message),
    workbench: workbenchBindingsSlice,
  }));

  return {
    bootstrap,
  };
}

export function startRendererApp(): void {
  const rendererApp = createRendererApp();
  void rendererApp.bootstrap();
}
