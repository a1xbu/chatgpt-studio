import type { RendererServices } from '../app/context';
import type {
  RendererAppStoreSlice,
  RendererBottomPanelStoreSlice,
  RendererStore,
} from '../app/store';
import type { RendererUiRefs } from '../app/ui-refs';
import type {
  RendererBottomPanelBindingsSlice,
  RendererBottomPanelBootstrapSlice,
} from '../bootstrap/renderer-context';
import type { DesktopPocApi } from '../desktop-api';
import type { BottomPanelFeature, BottomPanelFeatureBaseOptions } from './feature';

export type CreateRendererBottomPanelFeatureBaseOptionsArgs = {
  appState: RendererAppStoreSlice;
  bottomPanelState: RendererBottomPanelStoreSlice;
  store: Pick<
    RendererStore,
    | 'getBottomPanelRuntimeState'
    | 'setBottomPanelRuntimeState'
    | 'getGitRuntimeState'
    | 'setGitRuntimeState'
    | 'getDebugRuntimeState'
    | 'getTerminalUiState'
    | 'setTerminalUiState'
  >;
  renderApp: () => void;
  elements: Pick<
    RendererUiRefs,
    | 'appShellElement'
    | 'workbenchElement'
    | 'toggleBottomPanelButton'
    | 'bottomPanelResizerElement'
    | 'bottomTabsElement'
    | 'debugConsoleElement'
    | 'debugRetentionElement'
    | 'debugViewElement'
    | 'terminalViewElement'
    | 'gitViewElement'
    | 'terminalPaneElement'
    | 'terminalEmptyElement'
    | 'terminalMetaElement'
    | 'terminalHostElement'
  >;
  storage: {
    localStorage: Storage;
    debugCollapsedStorageKey: string;
    debugHeightStorageKey: string;
  };
  limits: {
    maxDebugLogs: number;
    minDebugPanelHeight: number;
    maxDebugPanelHeight: number;
  };
  services: {
    timers: Pick<RendererServices['timers'], 'requestAnimationFrame'>;
    clipboard: Clipboard | undefined;
    documentLike: Document;
  };
  desktopApi: Pick<
    DesktopPocApi,
    | 'writeTerminal'
    | 'resizeTerminal'
    | 'startTerminal'
    | 'closeTerminal'
    | 'clearDebugLogs'
    | 'getGitOverview'
    | 'getGitCommitDetails'
  >;
  layout: {
    startDrag: BottomPanelFeatureBaseOptions['layout']['startDrag'];
  };
  formatters: {
    escapeHtml: BottomPanelFeatureBaseOptions['formatters']['escapeHtml'];
    formatTimestamp: BottomPanelFeatureBaseOptions['formatters']['formatTimestamp'];
  };
  icons: BottomPanelFeatureBaseOptions['icons'];
};

export type CreateRendererBottomPanelBootstrapSliceArgs = {
  bottomPanelState: RendererBottomPanelStoreSlice;
  getFeature: () => Pick<BottomPanelFeature, 'actions'>;
};

export type CreateRendererBottomPanelBindingsSliceArgs = {
  bottomPanelState: RendererBottomPanelStoreSlice;
  getFeature: () => Pick<BottomPanelFeature, 'actions' | 'render' | 'selectors'>;
};

export function createRendererBottomPanelFeatureBaseOptions(
  args: CreateRendererBottomPanelFeatureBaseOptionsArgs,
): BottomPanelFeatureBaseOptions {
  return {
    collapsedGitCommitDirectoryKeys: args.bottomPanelState.collapsedGitCommitDirectoryKeys,
    getCurrentState: () => args.appState.currentState,
    getBottomPanelRuntimeState: args.store.getBottomPanelRuntimeState,
    setBottomPanelRuntimeState: args.store.setBottomPanelRuntimeState,
    getGitRuntimeState: args.store.getGitRuntimeState,
    setGitRuntimeState: args.store.setGitRuntimeState,
    getDebugRuntimeState: args.store.getDebugRuntimeState,
    setDebugLogs: (entries) => {
      args.bottomPanelState.debugLogs = entries;
    },
    setDebugFilterText: (value) => {
      args.bottomPanelState.debugFilterText = value;
    },
    setDebugRetentionLimit: (value) => {
      args.bottomPanelState.debugRetentionLimit = value;
    },
    maxDebugLogs: args.limits.maxDebugLogs,
    getTerminalUiState: args.store.getTerminalUiState,
    setTerminalUiState: args.store.setTerminalUiState,
    getTerminalFitScheduled: () => args.bottomPanelState.terminalFitScheduled,
    setTerminalFitScheduled: (value) => {
      args.bottomPanelState.terminalFitScheduled = value;
    },
    renderApp: args.renderApp,
    elements: args.elements,
    storage: args.storage,
    limits: {
      minDebugPanelHeight: args.limits.minDebugPanelHeight,
      maxDebugPanelHeight: args.limits.maxDebugPanelHeight,
    },
    timers: {
      requestAnimationFrame: args.services.timers.requestAnimationFrame,
    },
    clipboard: {
      clipboard: args.services.clipboard,
      documentLike: args.services.documentLike,
    },
    desktopApi: args.desktopApi,
    layout: args.layout,
    formatters: args.formatters,
    icons: args.icons,
  };
}

export function createRendererBottomPanelBootstrapSlice(
  args: CreateRendererBottomPanelBootstrapSliceArgs,
): RendererBottomPanelBootstrapSlice {
  return {
    uiState: {
      applyDebugPanelHeight: (height) => {
        args.getFeature().actions.applyDebugPanelHeight(height);
      },
      applyDebugPanelState: () => {
        args.getFeature().actions.applyDebugPanelState();
      },
      installBottomPanelResizer: () => {
        args.getFeature().actions.installResizer();
      },
    },
    state: {
      setDebugLogs: (entries) => {
        args.bottomPanelState.debugLogs = entries;
      },
      setTerminalSessions: (sessions) => {
        args.bottomPanelState.terminalSessions = sessions;
      },
      setDebugRetentionLimit: (value) => {
        args.bottomPanelState.debugRetentionLimit = value;
      },
      setIsDebugPanelCollapsed: (value) => {
        args.bottomPanelState.isDebugPanelCollapsed = value;
      },
    },
    actions: {
      createTerminalSessionState: (snapshot) => args.getFeature().actions.createTerminalSessionState(snapshot),
      addDebugLog: (source, level, message, details) => {
        args.getFeature().actions.addDebugLog(source, level, message, details);
      },
      pushDebugLogEntry: (entry) => {
        args.getFeature().actions.pushDebugLog(entry);
      },
      handleTerminalData: (payload) => {
        args.getFeature().actions.handleTerminalData(payload);
      },
      handleTerminalExit: (payload) => {
        args.getFeature().actions.handleTerminalExit(payload);
      },
      scheduleTerminalFit: () => {
        args.getFeature().actions.scheduleTerminalFit();
      },
    },
  };
}

export function createRendererBottomPanelBindingsSlice(
  args: CreateRendererBottomPanelBindingsSliceArgs,
): RendererBottomPanelBindingsSlice {
  return {
    state: {
      toggleBottomPanel: () => {
        args.getFeature().actions.toggleBottomPanel();
      },
      getGitPanelProjectId: () => args.bottomPanelState.gitPanelProjectId,
      getSelectedGitRefName: () => args.bottomPanelState.gitPanelSelectedRefName,
      setSelectedGitBranchName: (branchName) => {
        args.bottomPanelState.selectedGitBranchName = branchName;
      },
      getSelectedGitCommitHash: () => args.bottomPanelState.selectedGitCommitHash,
      setSelectedGitCommitHash: (commitHash) => {
        args.bottomPanelState.selectedGitCommitHash = commitHash;
      },
      clearGitCommitDetailsState: (isLoading) => {
        args.bottomPanelState.gitCommitDetails = null;
        args.bottomPanelState.gitCommitDetailsError = null;
        args.bottomPanelState.gitCommitDetailsIsLoading = isLoading;
      },
      setGitPanelLoadError: (message) => {
        args.bottomPanelState.gitPanelLoadError = message;
      },
      setDebugFilterText: (value) => {
        args.bottomPanelState.debugFilterText = value;
      },
      setDebugRetentionLimit: (value) => {
        args.bottomPanelState.debugRetentionLimit = value;
      },
    },
    actions: {
      copyVisibleDebugLogs: () => args.getFeature().actions.copyVisibleDebugLogs(),
      clearDebugLogs: () => args.getFeature().actions.clearDebugLogs(),
      openEmbeddedTerminal: () => args.getFeature().actions.openEmbeddedTerminal(),
      closeTerminalSession: (sessionId) => args.getFeature().actions.closeTerminalSession(sessionId),
      switchBottomTab: (tabId) => {
        args.getFeature().actions.switchBottomTab(tabId);
      },
      renderDebugLogs: () => {
        args.getFeature().render.debugLogs();
      },
      refreshGitPanel: (projectId, refName) => args.getFeature().actions.refreshGitPanel(projectId, refName),
      renderBottomPanel: () => {
        args.getFeature().render.bottomPanel();
      },
      renderGitPanel: () => {
        args.getFeature().render.gitPanel();
      },
      refreshGitCommitDetails: (projectId, commitHash) => args.getFeature().actions.refreshGitCommitDetails(projectId, commitHash),
      getGitCommitDirectoryKey: (commitHash, relativePath) => args.getFeature().selectors.getGitCommitDirectoryKey(commitHash, relativePath),
      addDebugLog: (source, level, message, details) => {
        args.getFeature().actions.addDebugLog(source, level, message, details);
      },
    },
  };
}
