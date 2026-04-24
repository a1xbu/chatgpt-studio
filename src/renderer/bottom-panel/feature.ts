import type { AppStateSnapshot, DebugLogEntry, SidebarProject } from '../../shared/contracts';
import { copyTextToClipboard as copyTextToClipboardImpl } from '../debug/clipboard';
import {
  addDebugLog as addDebugLogImpl,
  clearDebugLogs as clearDebugLogsImpl,
  copyVisibleDebugLogs as copyVisibleDebugLogsImpl,
  pushDebugLog as pushDebugLogImpl,
} from '../debug/actions';
import {
  formatDebugLogsForClipboard as formatDebugLogsForClipboardImpl,
  getVisibleDebugLogs as getVisibleDebugLogsImpl,
  renderDebugLogs as renderDebugLogsImpl,
  type DebugRuntimeState,
} from '../debug/runtime';
import type { TerminalDataPayload, TerminalExitPayload, TerminalSessionSnapshot, TerminalSessionState } from '../desktop-api';
import { renderGitFileTreeNodes as renderGitFileTreeNodesImpl, type GitFileTreeNode } from '../git/git-file-tree';
import { getGitStatusLabel } from '../git/panel';
import {
  getActiveGitProject as getActiveGitProjectImpl,
  refreshGitCommitDetails as refreshGitCommitDetailsImpl,
  refreshGitPanel as refreshGitPanelImpl,
  renderGitPanel as renderGitPanelStateImpl,
  shouldRenderGitTab as shouldRenderGitTabImpl,
  syncGitPanelWithCurrentProject as syncGitPanelWithCurrentProjectImpl,
  type GitRuntimeState,
} from '../git/runtime';
import type { GitCommitDetailsResult, GitOverviewResult } from '../git/types';
import {
  applyDebugPanelHeight as applyDebugPanelHeightImpl,
  applyDebugPanelState as applyDebugPanelStateImpl,
} from '../sidebar/runtime';
import { renderSharedFileTreeItem as renderSharedFileTreeItemImpl, type SharedFileTreeRowModel } from '../tree/shared-tree';
import type { XtermFitAddon, XtermTerminal } from '../runtime-types';
import { installBottomPanelResizer as installBottomPanelResizerImpl } from '../layout/resizers';
import {
  closeEmbeddedTerminal as closeEmbeddedTerminalImpl,
  openEmbeddedTerminal as openEmbeddedTerminalImpl,
  switchBottomTab as switchBottomTabImpl,
  type BottomPanelRuntimeState,
} from './runtime';
import {
  ensureTerminalUi as ensureTerminalUiRuntime,
  getActiveTerminalSession as getActiveTerminalSessionRuntime,
  getTerminalSession as getTerminalSessionRuntime,
  renderBottomPanel as renderBottomPanelRuntime,
  renderBottomTabs as renderBottomTabsRuntime,
  resizeVisibleTerminals as resizeVisibleTerminalsRuntime,
  scheduleTerminalFit as scheduleTerminalFitRuntime,
  syncTerminalViewport as syncBottomPanelTerminalViewportRuntime,
  type BottomPanelTerminalUiState,
} from './runtime-view';
import { createTerminalSessionState as createTerminalSessionStateImpl } from './terminal';

export type BottomPanelFeature = {
  selectors: {
    getTerminalSession: (sessionId: string) => TerminalSessionState | undefined;
    getActiveTerminalSession: () => TerminalSessionState | null;
    getVisibleDebugLogs: () => DebugLogEntry[];
    getActiveGitProject: () => SidebarProject | null;
    shouldRenderGitTab: () => boolean;
    getGitCommitDirectoryKey: (commitHash: string, relativePath?: string) => string;
  };
  actions: {
    applyDebugPanelHeight: (height: number) => void;
    applyDebugPanelState: () => void;
    toggleBottomPanel: () => void;
    installResizer: () => void;
    setDebugFilterText: (value: string) => void;
    setDebugRetentionLimit: (value: number) => void;
    pushDebugLog: (entry: DebugLogEntry) => void;
    addDebugLog: (
      source: DebugLogEntry['source'],
      level: DebugLogEntry['level'],
      message: string,
      details?: string | null,
    ) => void;
    syncActiveTerminalViewport: (force?: boolean) => void;
    ensureTerminalUi: () => void;
    resizeVisibleTerminals: () => void;
    scheduleTerminalFit: () => void;
    switchBottomTab: (nextTabId: string) => void;
    createTerminalSessionState: (snapshot: TerminalSessionSnapshot) => TerminalSessionState;
    openEmbeddedTerminal: () => Promise<void>;
    closeTerminalSession: (sessionId: string) => Promise<void>;
    copyVisibleDebugLogs: () => Promise<void>;
    clearDebugLogs: () => Promise<void>;
    refreshGitCommitDetails: (projectId: string, commitHash: string | null) => Promise<void>;
    refreshGitPanel: (projectId: string, refName?: string | null) => Promise<void>;
    syncGitPanelWithCurrentProject: () => void;
    handleTerminalData: (payload: TerminalDataPayload) => void;
    handleTerminalExit: (payload: TerminalExitPayload) => void;
  };
  render: {
    debugLogs: () => void;
    bottomTabs: () => void;
    gitPanel: () => void;
    bottomPanel: () => void;
  };
};

export type BottomPanelFeatureBaseOptions = Omit<BottomPanelFeatureOptions, 'getActiveSidebarProject'>;

export type BottomPanelFeatureOptions = {
  collapsedGitCommitDirectoryKeys: Set<string>;
  getCurrentState: () => AppStateSnapshot | null;
  getBottomPanelRuntimeState: () => BottomPanelRuntimeState;
  setBottomPanelRuntimeState: (nextState: BottomPanelRuntimeState) => void;
  getGitRuntimeState: () => GitRuntimeState;
  setGitRuntimeState: (nextState: GitRuntimeState) => void;
  getDebugRuntimeState: () => DebugRuntimeState;
  setDebugLogs: (entries: DebugLogEntry[]) => void;
  setDebugFilterText: (value: string) => void;
  setDebugRetentionLimit: (value: number) => void;
  maxDebugLogs: number;
  getTerminalUiState: () => BottomPanelTerminalUiState;
  setTerminalUiState: (nextState: BottomPanelTerminalUiState) => void;
  getTerminalFitScheduled: () => boolean;
  setTerminalFitScheduled: (value: boolean) => void;
  getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
  renderApp: () => void;
  elements: {
    appShellElement: HTMLElement | null;
    workbenchElement: HTMLElement | null;
    toggleBottomPanelButton: HTMLButtonElement | null;
    bottomPanelResizerElement: HTMLElement | null;
    bottomTabsElement: HTMLElement | null;
    debugConsoleElement: HTMLElement | null;
    debugRetentionElement: HTMLElement | null;
    debugViewElement: HTMLElement | null;
    terminalViewElement: HTMLElement | null;
    gitViewElement: HTMLElement | null;
    terminalPaneElement: HTMLElement | null;
    terminalEmptyElement: HTMLElement | null;
    terminalMetaElement: HTMLElement | null;
    terminalHostElement: HTMLElement | null;
  };
  storage: {
    localStorage: Storage;
    debugCollapsedStorageKey: string;
    debugHeightStorageKey: string;
  };
  limits: {
    minDebugPanelHeight: number;
    maxDebugPanelHeight: number;
  };
  timers: {
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
  };
  clipboard: {
    clipboard: Clipboard | undefined;
    documentLike: Document;
  };
  desktopApi: {
    writeTerminal: (sessionId: string, data: string) => Promise<void>;
    resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
    startTerminal: (cwd: string | null, cols: number, rows: number) => Promise<TerminalSessionSnapshot>;
    closeTerminal: (sessionId: string) => Promise<void>;
    clearDebugLogs: () => Promise<void>;
    getGitOverview: (projectId: string, refName?: string | null) => Promise<GitOverviewResult>;
    getGitCommitDetails: (projectId: string, commitHash: string) => Promise<GitCommitDetailsResult>;
  };
  layout: {
    startDrag: (cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void) => void;
  };
  formatters: {
    escapeHtml: (value: string | null | undefined) => string;
    formatTimestamp: (value: string | null | undefined) => string;
  };
  icons: {
    renderChevronIcon: () => string;
    renderFolderTreeIcon: (isOpen?: boolean) => string;
    renderFileTreeFileIcon: () => string;
    renderRefreshIcon: () => string;
  };
};

export function createBottomPanelFeature(options: BottomPanelFeatureOptions): BottomPanelFeature {
  function getTerminalSession(sessionId: string): TerminalSessionState | undefined {
    return getTerminalSessionRuntime(sessionId, options.getBottomPanelRuntimeState().terminalSessions);
  }

  function getActiveTerminalSession(): TerminalSessionState | null {
    const state = options.getBottomPanelRuntimeState();
    return getActiveTerminalSessionRuntime({
      activeBottomTabId: state.activeBottomTabId,
      terminalSessions: state.terminalSessions,
    });
  }

  function getVisibleDebugLogs(): DebugLogEntry[] {
    return getVisibleDebugLogsImpl(options.getDebugRuntimeState());
  }

  function getActiveGitProject(): SidebarProject | null {
    return getActiveGitProjectImpl(options.getCurrentState(), {
      getActiveSidebarProject: options.getActiveSidebarProject,
    });
  }

  function shouldRenderGitTab(): boolean {
    return shouldRenderGitTabImpl(options.getCurrentState(), options.getGitRuntimeState(), {
      getActiveSidebarProject: options.getActiveSidebarProject,
    });
  }

  function getGitCommitDirectoryKey(commitHash: string, relativePath = ''): string {
    return `${commitHash}::${relativePath}`;
  }

  function renderDebugLogs(): void {
    renderDebugLogsImpl({
      state: options.getDebugRuntimeState(),
      debugConsoleElement: options.elements.debugConsoleElement,
      debugRetentionElement: options.elements.debugRetentionElement,
      escapeHtml: options.formatters.escapeHtml,
      formatTimestamp: options.formatters.formatTimestamp,
    });
  }

  function renderBottomTabs(): void {
    const state = options.getBottomPanelRuntimeState();
    renderBottomTabsRuntime({
      bottomTabsElement: options.elements.bottomTabsElement,
      activeBottomTabId: state.activeBottomTabId,
      terminalSessions: state.terminalSessions,
      showGitTab: shouldRenderGitTab(),
      escapeHtml: options.formatters.escapeHtml,
    });
  }

  function renderSharedGitFileTreeItem(model: SharedFileTreeRowModel): string {
    return renderSharedFileTreeItemImpl(model, {
      escapeHtml: options.formatters.escapeHtml,
      renderChevronIcon: options.icons.renderChevronIcon,
    });
  }

  function renderGitFileTreeNodes(commitHash: string, nodes: GitFileTreeNode[], depth = 0): string {
    return renderGitFileTreeNodesImpl(
      commitHash,
      nodes,
      {
        escapeHtml: options.formatters.escapeHtml,
        renderFolderTreeIcon: options.icons.renderFolderTreeIcon,
        renderFileTreeFileIcon: options.icons.renderFileTreeFileIcon,
        renderSharedFileTreeItem: renderSharedGitFileTreeItem,
        getGitStatusLabel,
        getGitCommitDirectoryKey,
        isDirectoryCollapsed: (directoryKey) => options.collapsedGitCommitDirectoryKeys.has(directoryKey),
      },
      depth,
    );
  }

  function renderGitPanel(): void {
    renderGitPanelStateImpl({
      currentState: options.getCurrentState(),
      state: options.getGitRuntimeState(),
      gitViewElement: options.elements.gitViewElement,
      getActiveSidebarProject: options.getActiveSidebarProject,
      escapeHtml: options.formatters.escapeHtml,
      formatTimestamp: options.formatters.formatTimestamp,
      renderGitFileTreeNodes: (commitHash, nodes) => renderGitFileTreeNodes(commitHash, nodes),
      renderRefreshIcon: options.icons.renderRefreshIcon,
    });
  }

  function syncActiveTerminalViewport(force = false): void {
    const bottomPanelState = options.getBottomPanelRuntimeState();
    const terminalUiState = options.getTerminalUiState();
    const nextState = syncBottomPanelTerminalViewportRuntime(
      {
        activeBottomTabId: bottomPanelState.activeBottomTabId,
        terminalSessions: bottomPanelState.terminalSessions,
        isDebugPanelCollapsed: bottomPanelState.isDebugPanelCollapsed,
        renderedTerminalSessionId: bottomPanelState.renderedTerminalSessionId,
        renderedTerminalOutputLength: bottomPanelState.renderedTerminalOutputLength,
      },
      terminalUiState.terminalInstance,
      force,
    );

    options.setBottomPanelRuntimeState({
      ...bottomPanelState,
      activeBottomTabId: nextState.activeBottomTabId,
      renderedTerminalSessionId: nextState.renderedTerminalSessionId,
      renderedTerminalOutputLength: nextState.renderedTerminalOutputLength,
    });
  }

  function ensureTerminalUi(): void {
    const nextUiState = ensureTerminalUiRuntime(
      options.getTerminalUiState(),
      {
        terminalHostElement: options.elements.terminalHostElement,
      },
      {
        getActiveTerminalSession,
        writeTerminalInput: (sessionId, data) => {
          void options.desktopApi.writeTerminal(sessionId, data);
        },
      },
    );

    options.setTerminalUiState(nextUiState);
  }

  function resizeVisibleTerminals(): void {
    resizeVisibleTerminalsRuntime(
      options.getTerminalUiState().terminalInstance,
      options.getBottomPanelRuntimeState().terminalSessions,
      (sessionId, cols, rows) => {
        void options.desktopApi.resizeTerminal(sessionId, cols, rows);
      },
    );
  }

  function scheduleTerminalFit(): void {
    const bottomPanelState = options.getBottomPanelRuntimeState();
    const terminalUiState = options.getTerminalUiState();
    scheduleTerminalFitRuntime({
      isScheduled: options.getTerminalFitScheduled(),
      setScheduled: options.setTerminalFitScheduled,
      terminalInstance: terminalUiState.terminalInstance,
      terminalFitAddon: terminalUiState.terminalFitAddon,
      terminalHostElement: options.elements.terminalHostElement,
      activeBottomTabId: bottomPanelState.activeBottomTabId,
      isDebugPanelCollapsed: bottomPanelState.isDebugPanelCollapsed,
      requestAnimationFrame: options.timers.requestAnimationFrame,
      resizeVisibleTerminals,
    });
  }

  function applyDebugPanelHeight(height: number): void {
    applyDebugPanelHeightImpl(
      height,
      options.clipboard.documentLike.documentElement,
      options.storage.localStorage,
      options.storage.debugHeightStorageKey,
    );
  }

  function applyDebugPanelState(): void {
    applyDebugPanelStateImpl({
      appShellElement: options.elements.appShellElement,
      toggleBottomPanelButton: options.elements.toggleBottomPanelButton,
      isDebugPanelCollapsed: options.getBottomPanelRuntimeState().isDebugPanelCollapsed,
      storage: options.storage.localStorage,
      storageKey: options.storage.debugCollapsedStorageKey,
      scheduleTerminalFit,
    });
  }

  function toggleBottomPanel(): void {
    const state = options.getBottomPanelRuntimeState();
    options.setBottomPanelRuntimeState({
      ...state,
      isDebugPanelCollapsed: !state.isDebugPanelCollapsed,
    });
    applyDebugPanelState();
  }

  function installResizer(): void {
    installBottomPanelResizerImpl(options.elements.bottomPanelResizerElement, options.elements.workbenchElement, {
      isDebugPanelCollapsed: () => options.getBottomPanelRuntimeState().isDebugPanelCollapsed,
      startDrag: options.layout.startDrag,
      applyDebugPanelHeight,
      scheduleTerminalFit,
      minDebugPanelHeight: options.limits.minDebugPanelHeight,
      maxDebugPanelHeight: options.limits.maxDebugPanelHeight,
    });
  }

  function pushDebugLog(entry: DebugLogEntry): void {
    pushDebugLogImpl(entry, {
      getDebugLogs: () => options.getDebugRuntimeState().debugLogs,
      setDebugLogs: options.setDebugLogs,
      maxDebugLogs: options.maxDebugLogs,
      renderDebugLogs,
    });
  }

  function addDebugLog(
    source: DebugLogEntry['source'],
    level: DebugLogEntry['level'],
    message: string,
    details: string | null = null,
  ): void {
    addDebugLogImpl(source, level, message, details, {
      getDebugLogs: () => options.getDebugRuntimeState().debugLogs,
      setDebugLogs: options.setDebugLogs,
      maxDebugLogs: options.maxDebugLogs,
      renderDebugLogs,
      createTimestamp: () => new Date().toISOString(),
    });
  }

  function setDebugFilterText(value: string): void {
    options.setDebugFilterText(value);
  }

  function setDebugRetentionLimit(value: number): void {
    options.setDebugRetentionLimit(value);
  }

  function isRenderedTerminalSessionActive(sessionId: string): boolean {
    const state = options.getBottomPanelRuntimeState();
    return state.renderedTerminalSessionId === sessionId
      && state.activeBottomTabId === sessionId
      && Boolean(options.getTerminalUiState().terminalInstance);
  }

  function writeRenderedTerminalOutput(data: string): void {
    options.getTerminalUiState().terminalInstance?.write(data);
  }

  function setRenderedTerminalOutputLength(value: number): void {
    const state = options.getBottomPanelRuntimeState();
    options.setBottomPanelRuntimeState({
      ...state,
      renderedTerminalOutputLength: value,
    });
  }

  function handleTerminalData(payload: TerminalDataPayload): void {
    const targetSession = getTerminalSession(payload.sessionId);
    if (!targetSession) {
      return;
    }

    targetSession.outputBuffer += payload.data;
    if (isRenderedTerminalSessionActive(payload.sessionId)) {
      writeRenderedTerminalOutput(payload.data);
      setRenderedTerminalOutputLength(targetSession.outputBuffer.length);
    }
  }

  function handleTerminalExit(payload: TerminalExitPayload): void {
    const targetSession = getTerminalSession(payload.sessionId);
    if (!targetSession) {
      return;
    }

    const exitMessage = `\r\n\x1b[33m[process exited with code ${String(payload.exitCode)}]\x1b[0m\r\n`;
    targetSession.outputBuffer += exitMessage;
    targetSession.exited = true;
    if (isRenderedTerminalSessionActive(payload.sessionId)) {
      writeRenderedTerminalOutput(exitMessage);
      setRenderedTerminalOutputLength(targetSession.outputBuffer.length);
    }

    renderBottomPanel();
  }

  function createTerminalSessionState(snapshot: TerminalSessionSnapshot): TerminalSessionState {
    const state = options.getBottomPanelRuntimeState();
    const created = createTerminalSessionStateImpl(snapshot, state.nextTerminalOrdinal);
    options.setBottomPanelRuntimeState({
      ...state,
      nextTerminalOrdinal: created.nextTerminalOrdinal,
    });
    return created.sessionState;
  }

  function renderBottomPanel(): void {
    const bottomPanelState = options.getBottomPanelRuntimeState();
    const terminalUiState = options.getTerminalUiState();
    const nextState = renderBottomPanelRuntime({
      state: {
        activeBottomTabId: bottomPanelState.activeBottomTabId,
        terminalSessions: bottomPanelState.terminalSessions,
        isDebugPanelCollapsed: bottomPanelState.isDebugPanelCollapsed,
        renderedTerminalSessionId: bottomPanelState.renderedTerminalSessionId,
        renderedTerminalOutputLength: bottomPanelState.renderedTerminalOutputLength,
      },
      elements: {
        debugViewElement: options.elements.debugViewElement,
        terminalViewElement: options.elements.terminalViewElement,
        gitViewElement: options.elements.gitViewElement,
        terminalPaneElement: options.elements.terminalPaneElement,
        terminalEmptyElement: options.elements.terminalEmptyElement,
        terminalMetaElement: options.elements.terminalMetaElement,
        terminalInstance: terminalUiState.terminalInstance,
      },
      helpers: {
        shouldRenderGitTab,
        renderBottomTabs,
        renderGitPanel,
        ensureTerminalUi: () => {
          ensureTerminalUi();
          return options.getTerminalUiState().terminalInstance;
        },
        scheduleTerminalFit,
      },
    });

    options.setBottomPanelRuntimeState({
      ...bottomPanelState,
      activeBottomTabId: nextState.activeBottomTabId,
      renderedTerminalSessionId: nextState.renderedTerminalSessionId,
      renderedTerminalOutputLength: nextState.renderedTerminalOutputLength,
    });
  }

  function switchBottomTab(nextTabId: string): void {
    switchBottomTabImpl({
      nextTabId,
      state: options.getBottomPanelRuntimeState(),
      setState: options.setBottomPanelRuntimeState,
      renderBottomPanel,
      syncActiveTerminalViewport,
      scheduleTerminalFit,
      focusTerminal: () => {
        options.getTerminalUiState().terminalInstance?.focus();
      },
      requestAnimationFrame: options.timers.requestAnimationFrame,
    });
  }

  async function openEmbeddedTerminal(): Promise<void> {
    await openEmbeddedTerminalImpl({
      getState: options.getBottomPanelRuntimeState,
      currentState: options.getCurrentState(),
      setState: options.setBottomPanelRuntimeState,
      terminalUi: {
        ensureTerminalUi,
        getTerminalInstance: () => options.getTerminalUiState().terminalInstance,
        getTerminalFitAddon: () => options.getTerminalUiState().terminalFitAddon,
        focusTerminal: () => {
          options.getTerminalUiState().terminalInstance?.focus();
        },
        resetTerminalViewport: () => {
          options.getTerminalUiState().terminalInstance?.reset();
          options.getTerminalUiState().terminalInstance?.clear();
        },
      },
      renderCallbacks: {
        applyDebugPanelState,
        renderBottomPanel,
        scheduleTerminalFit,
        syncActiveTerminalViewport,
      },
      desktopApi: {
        startTerminal: options.desktopApi.startTerminal,
      },
      requestAnimationFrame: options.timers.requestAnimationFrame,
    });
  }

  async function closeTerminalSession(sessionId: string): Promise<void> {
    await closeEmbeddedTerminalImpl({
      sessionId,
      getState: options.getBottomPanelRuntimeState,
      setState: options.setBottomPanelRuntimeState,
      terminalUi: {
        ensureTerminalUi,
        getTerminalInstance: () => options.getTerminalUiState().terminalInstance,
        getTerminalFitAddon: () => options.getTerminalUiState().terminalFitAddon,
        focusTerminal: () => {
          options.getTerminalUiState().terminalInstance?.focus();
        },
        resetTerminalViewport: () => {
          options.getTerminalUiState().terminalInstance?.reset();
          options.getTerminalUiState().terminalInstance?.clear();
        },
      },
      renderCallbacks: {
        applyDebugPanelState,
        renderBottomPanel,
        scheduleTerminalFit,
        syncActiveTerminalViewport,
      },
      desktopApi: {
        closeTerminal: options.desktopApi.closeTerminal,
      },
    });
  }

  async function copyVisibleDebugLogs(): Promise<void> {
    await copyVisibleDebugLogsImpl({
      getVisibleDebugLogs,
      formatDebugLogsForClipboard: (entries) => formatDebugLogsForClipboardImpl(entries, options.formatters.formatTimestamp),
      copyTextToClipboard: (text, clipboard, documentLike) => copyTextToClipboardImpl(text, clipboard, documentLike),
      clipboard: options.clipboard.clipboard,
      documentLike: options.clipboard.documentLike,
    });
  }

  async function clearDebugLogs(): Promise<void> {
    await clearDebugLogsImpl({
      setDebugLogs: options.setDebugLogs,
      renderDebugLogs,
      clearDebugLogs: options.desktopApi.clearDebugLogs,
    });
  }

  async function refreshGitCommitDetails(projectId: string, commitHash: string | null): Promise<void> {
    await refreshGitCommitDetailsImpl({
      projectId,
      commitHash,
      getState: options.getGitRuntimeState,
      setState: options.setGitRuntimeState,
      renderBottomPanel,
      getGitCommitDetails: options.desktopApi.getGitCommitDetails,
    });
  }

  async function refreshGitPanel(projectId: string, refName?: string | null): Promise<void> {
    await refreshGitPanelImpl({
      projectId,
      refName,
      getState: options.getGitRuntimeState,
      setState: options.setGitRuntimeState,
      renderBottomPanel,
      getGitOverview: options.desktopApi.getGitOverview,
      refreshGitCommitDetails,
    });
  }

  function syncGitPanelWithCurrentProject(): void {
    syncGitPanelWithCurrentProjectImpl({
      currentState: options.getCurrentState(),
      getState: options.getGitRuntimeState,
      setState: options.setGitRuntimeState,
      refreshGitPanel,
      getActiveSidebarProject: options.getActiveSidebarProject,
    });
  }

  return {
    selectors: {
      getTerminalSession,
      getActiveTerminalSession,
      getVisibleDebugLogs,
      getActiveGitProject,
      shouldRenderGitTab,
      getGitCommitDirectoryKey,
    },
    actions: {
      applyDebugPanelHeight,
      applyDebugPanelState,
      toggleBottomPanel,
      installResizer,
      setDebugFilterText,
      setDebugRetentionLimit,
      pushDebugLog,
      addDebugLog,
      syncActiveTerminalViewport,
      ensureTerminalUi,
      resizeVisibleTerminals,
      scheduleTerminalFit,
      switchBottomTab,
      createTerminalSessionState,
      openEmbeddedTerminal,
      closeTerminalSession,
      copyVisibleDebugLogs,
      clearDebugLogs,
      refreshGitCommitDetails,
      refreshGitPanel,
      syncGitPanelWithCurrentProject,
      handleTerminalData,
      handleTerminalExit,
    },
    render: {
      debugLogs: renderDebugLogs,
      bottomTabs: renderBottomTabs,
      gitPanel: renderGitPanel,
      bottomPanel: renderBottomPanel,
    },
  };
}
