import type {
  AppStateSnapshot,
  ChatHistoryRecord,
  DebugLogEntry,
  ProjectChatRecord,
  PromptRecord,
  SidebarProject,
} from '../../shared/contracts';
import { loadChatHistoryIntoTab as loadChatHistoryIntoTabImpl } from '../chat/controller';
import type { ChatHistoryUpdatePayload } from '../desktop-api';
import {
  createChatHistoryEmptyState as createChatHistoryEmptyStateImpl,
  createChatHistoryTabContent as createChatHistoryTabContentImpl,
  countReasoningBlocks,
} from '../chat/history';
import {
  formatChatMessageRole,
  formatChatMessageTimestamp,
  wrapTextAsMarkdownCodeFence,
} from '../chat/format';
import type { MarkdownItInstance } from '../runtime-types';
import type { SidebarSelection } from '../sidebar/types';
import {
  getPairedChatEditorTab as getPairedChatEditorTabImpl,
  getPairedChatSelection as getPairedChatSelectionImpl,
  isBrowserPairedWithChat as isBrowserPairedWithChatImpl,
} from '../workbench/pairing';
import {
  renderEditorArea as renderEditorAreaImpl,
  renderEditorTabs as renderEditorTabsImpl,
} from './view';
import {
  findChatEditorTab as findChatEditorTabInTabs,
  findPromptEditorTab as findPromptEditorTabInTabs,
  getChatEditorTabId as getChatEditorTabIdImpl,
  getPromptEditorTabId as getPromptEditorTabIdImpl,
  normalizeEditorTabsState as normalizeEditorTabsStateImpl,
  resolveSelectionForActiveEditorTab as resolveSelectionForActiveEditorTabImpl,
  updateEditorTabBarLayout as updateEditorTabBarLayoutImpl,
} from './controller';
import { createEditorRuntimeAdapter } from './runtime-adapter';
import type { EditorRuntimeState } from './runtime';
import type { ChatEditorTab, EditorTabState, PromptEditorTab } from './types';
import { createPromptRuntimeController } from '../prompts/tab-runtime';
import {
  cancelPromptEditing as cancelPromptEditingImpl,
  enterPromptEditMode as enterPromptEditModeImpl,
} from '../prompts/runtime';
import {
  createPromptEditorContent as createPromptEditorContentImpl,
  getPromptEditorStatusText,
} from '../prompts/editor';
import { renderPromptSidebarPanel as renderPromptSidebarPanelImpl } from '../render/workbench';

export type EditorFeature = {
  selectors: {
    getChatEditorTabId: (projectId: string, chatId: string) => string;
    getPromptEditorTabId: (promptId: string) => string;
    findChatEditorTab: (projectId: string, chatId: string) => ChatEditorTab | null;
    findPromptEditorTab: (promptId: string) => PromptEditorTab | null;
    getPairedChatSelection: () => Extract<SidebarSelection, { kind: 'chat' }> | null;
    getPairedChatEditorTab: () => ChatEditorTab | null;
    isBrowserPairedWithChat: (projectId: string, chatId: string) => boolean;
    resolveSelectionForActiveEditorTab: () => SidebarSelection | null;
  };
  actions: {
    normalizeEditorTabsState: () => void;
    updateEditorTabBarLayout: () => void;
    trimPromptEditorTabs: () => void;
    syncSelectionWithActiveEditorTab: () => void;
    loadChatHistoryIntoTab: (tab: ChatEditorTab, forceReload?: boolean) => Promise<void>;
    markChatHistoryTabStale: (projectId: string, chatId: string, options?: { revisionKey?: string | null; reloadIfVisible?: boolean }) => void;
    handleChatHistoryUpdated: (payload: ChatHistoryUpdatePayload) => void;
    ensureChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord, activate?: boolean) => Promise<ChatEditorTab>;
    activateEditorTab: (tabId: string) => void;
    activatePairedEditorView: (nextView: 'browser' | 'local') => void;
    openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => Promise<void>;
    closeEditorTab: (tabId: string) => void;
    loadPromptIntoTab: (tab: PromptEditorTab, forceReload?: boolean) => Promise<void>;
    refreshPromptEditorStatus: () => void;
    savePromptTab: (tab: PromptEditorTab) => Promise<void>;
    enterPromptEditMode: (tab: PromptEditorTab) => void;
    cancelPromptEditing: (tab: PromptEditorTab) => void;
    openPromptTab: (promptId: string) => Promise<void>;
  };
  render: {
    tabs: () => void;
    area: () => void;
    promptSidebarPanel: () => void;
  };
};

export type EditorFeatureOptions = {
  maxOpenChatTabs: number;
  maxOpenPromptTabs: number;
  editorTabBaseWidthPx: number;
  editorTabMinWidthPx: number;
  getCurrentState: () => AppStateSnapshot | null;
  getSelectedSidebarItem: () => SidebarSelection | null;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  getBrowserOpenedSidebarItem: () => SidebarSelection | null;
  getPrompts: () => PromptRecord[];
  promptContentCache: Map<string, string>;
  readPrompt: (promptId: string) => Promise<{ prompt: PromptRecord; content: string } | null>;
  writePrompt: (promptId: string, content: string) => Promise<PromptRecord>;
  refreshPrompts: (shouldRender?: boolean) => Promise<void>;
  getEditorRuntimeState: () => EditorRuntimeState;
  setEditorRuntimeState: (nextState: EditorRuntimeState) => void;
  getLastRenderedPromptEditorStateKey: () => string;
  setLastRenderedPromptEditorStateKey: (value: string) => void;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
  buildChatBrowserUrl: (projectId: string, chatId: string, projectUrl: string | null) => string;
  renderApp: () => void;
  renderPromptMenuPortal: () => void;
  renderPromptViewPanel: () => string;
  persistActiveLocalChatSelection: () => void;
  addDebugLog: (
    source: DebugLogEntry['source'],
    level: DebugLogEntry['level'],
    message: string,
    details?: string | null,
  ) => void;
  getChatHistory: (projectId: string, chatId: string) => Promise<ChatHistoryRecord | null>;
  markdownRenderer: MarkdownItInstance;
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  formatTreeTimestamp: (value: string | null | undefined) => string;
  formatFileSize: (value: number | null | undefined) => string;
  renderBrowserTabIcon: () => string;
  renderChatIcon: () => string;
  renderPromptIcon: () => string;
  renderCloseIcon: () => string;
  renderGenericFileIcon: () => string;
  editorTabsElement: HTMLElement | null;
  promptViewPanelElement: HTMLElement | null;
  promptEditorViewElement: HTMLElement | null;
  workbenchElement: HTMLElement | null;
  browserToolbarElement: HTMLElement | null;
  browserToolbarControlsElement: HTMLElement | null;
  browserAddressFormElement: HTMLFormElement | null;
  browserViewElement: HTMLElement | null;
  chatHistoryViewElement: HTMLElement | null;
  browserElement: HTMLElement | null;
};

export type EditorFeatureCrossFeatureOptions = Pick<
  EditorFeatureOptions,
  'refreshPrompts' | 'renderPromptMenuPortal' | 'renderPromptViewPanel'
>;

export type EditorFeatureBaseOptions = Omit<
  EditorFeatureOptions,
  keyof EditorFeatureCrossFeatureOptions
>;

export function createEditorFeature(options: EditorFeatureOptions): EditorFeature {
  function getRuntimeState(): EditorRuntimeState {
    return options.getEditorRuntimeState();
  }

  function setRuntimeState(nextState: EditorRuntimeState): void {
    options.setEditorRuntimeState(nextState);
  }

  function getChatEditorTabId(projectId: string, chatId: string): string {
    return getChatEditorTabIdImpl(projectId, chatId);
  }

  function getPromptEditorTabId(promptId: string): string {
    return getPromptEditorTabIdImpl(promptId);
  }

  function findChatEditorTab(projectId: string, chatId: string): ChatEditorTab | null {
    return findChatEditorTabInTabs(getRuntimeState().editorTabs, projectId, chatId);
  }

  function findPromptEditorTab(promptId: string): PromptEditorTab | null {
    return findPromptEditorTabInTabs(getRuntimeState().editorTabs, promptId);
  }

  function getPairedChatSelection(): Extract<SidebarSelection, { kind: 'chat' }> | null {
    return getPairedChatSelectionImpl(options.getBrowserOpenedSidebarItem());
  }

  function getPairedChatEditorTab(): ChatEditorTab | null {
    return getPairedChatEditorTabImpl({
      browserOpenedSidebarItem: options.getBrowserOpenedSidebarItem(),
      findChatEditorTab,
    });
  }

  function isBrowserPairedWithChat(projectId: string, chatId: string): boolean {
    return isBrowserPairedWithChatImpl(options.getBrowserOpenedSidebarItem(), projectId, chatId);
  }

  function normalizeEditorTabsState(): void {
    const state = getRuntimeState();
    const nextState = normalizeEditorTabsStateImpl({
      editorTabs: state.editorTabs,
      activeEditorTabId: state.activeEditorTabId,
      currentState: options.getCurrentState(),
      prompts: options.getPrompts(),
      findSidebarProject: options.findSidebarProject,
      findSidebarChat: options.findSidebarChat,
      maxOpenChatTabs: options.maxOpenChatTabs,
      maxOpenPromptTabs: options.maxOpenPromptTabs,
    });

    setRuntimeState({
      ...state,
      editorTabs: nextState.editorTabs,
      activeEditorTabId: nextState.activeEditorTabId,
    });
  }

  function updateEditorTabBarLayout(): void {
    updateEditorTabBarLayoutImpl({
      editorTabsElement: options.editorTabsElement,
      editorTabs: getRuntimeState().editorTabs,
      pairedSelection: getPairedChatSelection(),
      editorTabBaseWidthPx: options.editorTabBaseWidthPx,
      editorTabMinWidthPx: options.editorTabMinWidthPx,
    });
  }

  function trimPromptEditorTabs(): void {
    const state = getRuntimeState();
    const promptTabs = state.editorTabs.filter((tab): tab is PromptEditorTab => tab.kind === 'prompt');
    if (promptTabs.length <= options.maxOpenPromptTabs) {
      return;
    }

    const tabsToDrop = promptTabs.slice(0, promptTabs.length - options.maxOpenPromptTabs);
    const idsToDrop = new Set(tabsToDrop.map((tab) => tab.id));
    const nextTabs = state.editorTabs.filter((tab) => !idsToDrop.has(tab.id));
    const nextActiveEditorTabId = nextTabs.some((tab) => tab.id === state.activeEditorTabId)
      ? state.activeEditorTabId
      : promptTabs[promptTabs.length - 1]?.id ?? 'browser';

    setRuntimeState({
      ...state,
      editorTabs: nextTabs,
      activeEditorTabId: nextActiveEditorTabId,
    });
  }

  function resolveSelectionForActiveEditorTab(): SidebarSelection | null {
    const state = getRuntimeState();
    return resolveSelectionForActiveEditorTabImpl({
      activeEditorTabId: state.activeEditorTabId,
      editorTabs: state.editorTabs,
      browserOpenedSidebarItem: options.getBrowserOpenedSidebarItem(),
      selectedSidebarItem: options.getSelectedSidebarItem(),
      pairedSelection: getPairedChatSelection(),
    });
  }

  function syncSelectionWithActiveEditorTab(): void {
    const nextSelection = resolveSelectionForActiveEditorTab();
    if (JSON.stringify(options.getSelectedSidebarItem()) === JSON.stringify(nextSelection)) {
      return;
    }

    options.setSelectedSidebarItem(nextSelection);
  }

  function resolveLocalChatHistoryUrl(tab: ChatEditorTab, _history: ChatHistoryRecord | null): string {
    const state = options.getCurrentState();
    const project = state ? options.findSidebarProject(state, tab.projectId) : null;
    const chat = state && project ? options.findSidebarChat(state, tab.projectId, tab.chatId) : null;
    if (project && chat) {
      return options.resolveChatBrowserUrl(project, chat);
    }

    return options.buildChatBrowserUrl(tab.projectId, tab.chatId, project?.projectUrl ?? null);
  }

  function createPromptEditorContent(tab: PromptEditorTab): HTMLElement {
    return createPromptEditorContentImpl(tab, {
      createEmptyState: createChatHistoryEmptyState,
      escapeHtml: options.escapeHtml,
      renderMarkdown: (markdown) => options.markdownRenderer.render(markdown || ''),
      isActiveTab: () => getRuntimeState().activeEditorTabId === tab.id,
      onSave: () => savePromptTab(tab),
      onCancel: () => cancelPromptEditing(tab),
      refreshStatus: refreshPromptEditorStatus,
    });
  }

  function createChatHistoryEmptyState(message: string): HTMLDivElement {
    return createChatHistoryEmptyStateImpl(message);
  }

  function createChatHistoryTabContent(tab: ChatEditorTab): HTMLElement {
    return createChatHistoryTabContentImpl(
      tab,
      resolveLocalChatHistoryUrl(tab, tab.history),
      {
        formatTimestamp: options.formatTimestamp,
        formatFileSize: options.formatFileSize,
        formatChatMessageRole,
        formatChatMessageTimestamp: (message) => formatChatMessageTimestamp(message, options.formatTimestamp),
        renderMessageMarkdown: (message) => message.role === 'tool'
          ? options.markdownRenderer.render(wrapTextAsMarkdownCodeFence(message.text))
          : options.markdownRenderer.render(message.text),
        renderMarkdown: (markdown) => options.markdownRenderer.render(markdown),
        renderGenericFileIcon: options.renderGenericFileIcon,
      },
    );
  }

  function renderEditorTabs(): void {
    const state = getRuntimeState();
    renderEditorTabsImpl({
      editorTabsElement: options.editorTabsElement,
      editorTabs: state.editorTabs,
      activeEditorTabId: state.activeEditorTabId,
      activePairedEditorSubtab: state.activePairedEditorSubtab,
      currentStateIsReady: Boolean(options.getCurrentState()),
      pairedSelection: getPairedChatSelection(),
      findPairedChatLabel: (selection) => {
        const stateSnapshot = options.getCurrentState();
        return stateSnapshot
          ? options.findSidebarChat(stateSnapshot, selection.projectId, selection.chatId)?.chatName ?? null
          : null;
      },
      normalizeEditorTabsState,
      escapeHtml: options.escapeHtml,
      renderBrowserTabIcon: options.renderBrowserTabIcon,
      renderChatIcon: options.renderChatIcon,
      renderPromptIcon: options.renderPromptIcon,
      renderCloseIcon: options.renderCloseIcon,
    });
  }

  function renderEditorArea(): void {
    const state = getRuntimeState();
    renderEditorAreaImpl({
      editorTabsElement: options.editorTabsElement,
      editorTabs: state.editorTabs,
      activeEditorTabId: state.activeEditorTabId,
      activePairedEditorSubtab: state.activePairedEditorSubtab,
      currentStateIsReady: Boolean(options.getCurrentState()),
      pairedSelection: getPairedChatSelection(),
      findPairedChatLabel: (selection) => {
        const stateSnapshot = options.getCurrentState();
        return stateSnapshot
          ? options.findSidebarChat(stateSnapshot, selection.projectId, selection.chatId)?.chatName ?? null
          : null;
      },
      normalizeEditorTabsState,
      escapeHtml: options.escapeHtml,
      renderBrowserTabIcon: options.renderBrowserTabIcon,
      renderChatIcon: options.renderChatIcon,
      renderPromptIcon: options.renderPromptIcon,
      renderCloseIcon: options.renderCloseIcon,
      lastRenderedPromptEditorStateKey: options.getLastRenderedPromptEditorStateKey(),
      updateEditorTabBarLayout,
      workbenchElement: options.workbenchElement,
      browserToolbarElement: options.browserToolbarElement,
      browserToolbarControlsElement: options.browserToolbarControlsElement,
      browserAddressFormElement: options.browserAddressFormElement,
      browserViewElement: options.browserViewElement,
      chatHistoryViewElement: options.chatHistoryViewElement,
      promptEditorViewElement: options.promptEditorViewElement,
      browserElement: options.browserElement,
      getPairedChatEditorTab,
      createChatHistoryTabContent,
      createPromptEditorContent,
      renderPromptMenuPortal: options.renderPromptMenuPortal,
      setActivePairedEditorSubtab: (value) => {
        setRuntimeState({
          ...getRuntimeState(),
          activePairedEditorSubtab: value,
        });
      },
      setLastRenderedPromptEditorStateKey: options.setLastRenderedPromptEditorStateKey,
    });
  }


  function markChatHistoryTabStale(
    projectId: string,
    chatId: string,
    staleOptions: { revisionKey?: string | null; reloadIfVisible?: boolean } = {},
  ): void {
    const targetTab = findChatEditorTab(projectId, chatId);
    if (!targetTab) {
      return;
    }

    const revisionKey = staleOptions.revisionKey ?? null;
    if (revisionKey && targetTab.historyRevisionKey === revisionKey) {
      targetTab.pendingHistoryRevisionKey = null;
      targetTab.isHistoryStale = false;
      return;
    }

    targetTab.pendingHistoryRevisionKey = revisionKey;
    targetTab.isHistoryStale = true;

    if (targetTab.inFlightRequest) {
      targetTab.reloadAfterLoad = true;
      return;
    }

    if (staleOptions.reloadIfVisible && isVisibleChatEditorTab(targetTab)) {
      void loadChatHistoryIntoTab(targetTab, false);
    }
  }

  function isVisibleChatEditorTab(targetTab: ChatEditorTab): boolean {
    const state = getRuntimeState();
    if (state.activeEditorTabId === targetTab.id) {
      return true;
    }

    if (state.activeEditorTabId !== 'browser' || state.activePairedEditorSubtab !== 'local') {
      return false;
    }

    return getPairedChatEditorTab()?.id === targetTab.id;
  }

  function handleChatHistoryUpdated(payload: ChatHistoryUpdatePayload): void {
    if (!isBrowserPairedWithChat(payload.projectId, payload.chatId)) {
      return;
    }

    markChatHistoryTabStale(payload.projectId, payload.chatId, {
      revisionKey: payload.revisionKey,
      reloadIfVisible: true,
    });
  }

  async function loadChatHistoryIntoTab(tab: ChatEditorTab, forceReload = false): Promise<void> {
    await loadChatHistoryIntoTabImpl(tab as any, forceReload, {
      hasProjectFolder: (projectId) => {
        const project = options.getCurrentState()
          ? options.findPersistentSidebarProject(options.getCurrentState() as AppStateSnapshot, projectId)
          : null;
        return Boolean(project?.folderPath);
      },
      getChatHistory: options.getChatHistory,
      addDebugLog: (source, level, message, details = null) => {
        options.addDebugLog(source, level, message, details);
      },
      countReasoningBlocks: (history) => countReasoningBlocks(history as any),
      renderEditorArea,
    });
  }

  function refreshPromptEditorStatus(): void {
    const state = getRuntimeState();
    const activeTab = state.editorTabs.find((tab): tab is PromptEditorTab => tab.kind === 'prompt' && tab.id === state.activeEditorTabId) ?? null;
    const statusElement = options.promptEditorViewElement?.querySelector('[data-role="prompt-save-status"]');
    if (!(statusElement instanceof HTMLElement) || !activeTab) {
      return;
    }

    statusElement.textContent = getPromptEditorStatusText(activeTab);
  }

  function renderPromptSidebarPanel(): void {
    renderPromptSidebarPanelImpl(
      { promptViewPanelElement: options.promptViewPanelElement },
      options.renderPromptViewPanel,
      options.renderPromptMenuPortal,
    );
  }

  const promptRuntimeController = createPromptRuntimeController({
    readPrompt: options.readPrompt,
    writePrompt: options.writePrompt,
    promptContentCache: options.promptContentCache,
    renderEditorArea,
    renderEditorTabs,
    renderPromptSidebarPanel,
    refreshPromptEditorStatus,
    refreshPrompts: options.refreshPrompts,
    formatTreeTimestamp: options.formatTreeTimestamp,
    findPromptEditorTab,
    getPromptEditorTabId,
    trimPromptEditorTabs,
    getPrompts: options.getPrompts,
    getEditorTabs: () => getRuntimeState().editorTabs.filter((tab): tab is PromptEditorTab => tab.kind === 'prompt'),
    setEditorTabs: (nextPromptTabs) => {
      const state = getRuntimeState();
      const nonPromptTabs = state.editorTabs.filter((tab): tab is Exclude<EditorTabState, PromptEditorTab> => tab.kind !== 'prompt');
      setRuntimeState({
        ...state,
        editorTabs: [...nonPromptTabs, ...nextPromptTabs],
      });
    },
    getActiveEditorTabId: () => getRuntimeState().activeEditorTabId,
    setActiveEditorTabId: (tabId) => {
      setRuntimeState({
        ...getRuntimeState(),
        activeEditorTabId: tabId,
      });
    },
  });

  function getEditorRuntimeAdapter() {
    return createEditorRuntimeAdapter({
      getState: getRuntimeState,
      setState: setRuntimeState,
      getPairedChatEditorTab,
      persistActiveLocalChatSelection: options.persistActiveLocalChatSelection,
      syncSelectionWithActiveEditorTab,
      render: options.renderApp,
      renderEditorArea,
      loadChatHistoryIntoTab,
      loadPromptIntoTab,
      savePromptTab,
      maxOpenChatTabs: options.maxOpenChatTabs,
      isBrowserPairedWithChat,
    });
  }

  async function ensureChatHistoryTab(project: SidebarProject, chat: ProjectChatRecord, activate = false): Promise<ChatEditorTab> {
    return getEditorRuntimeAdapter().ensureChatHistoryTab(project, chat, activate);
  }

  function activateEditorTab(tabId: string): void {
    getEditorRuntimeAdapter().activateEditorTab(tabId);
  }

  function activatePairedEditorView(nextView: 'browser' | 'local'): void {
    getEditorRuntimeAdapter().activatePairedEditorView(nextView);
  }

  async function openChatHistoryTab(project: SidebarProject, chat: ProjectChatRecord): Promise<void> {
    await getEditorRuntimeAdapter().openChatHistoryTab(project, chat);
  }

  function closeEditorTab(tabId: string): void {
    getEditorRuntimeAdapter().closeEditorTab(tabId);
  }

  async function loadPromptIntoTab(tab: PromptEditorTab, forceReload = false): Promise<void> {
    await promptRuntimeController.loadPromptIntoTab(tab, forceReload);
  }

  async function savePromptTab(tab: PromptEditorTab): Promise<void> {
    await promptRuntimeController.savePromptTab(tab);
  }

  function enterPromptEditMode(tab: PromptEditorTab): void {
    enterPromptEditModeImpl(tab, renderEditorArea);
  }

  function cancelPromptEditing(tab: PromptEditorTab): void {
    cancelPromptEditingImpl(tab, renderEditorArea);
  }

  async function openPromptTab(promptId: string): Promise<void> {
    await promptRuntimeController.openPromptTab(promptId);
  }

  return {
    selectors: {
      getChatEditorTabId,
      getPromptEditorTabId,
      findChatEditorTab,
      findPromptEditorTab,
      getPairedChatSelection,
      getPairedChatEditorTab,
      isBrowserPairedWithChat,
      resolveSelectionForActiveEditorTab,
    },
    actions: {
      normalizeEditorTabsState,
      updateEditorTabBarLayout,
      trimPromptEditorTabs,
      syncSelectionWithActiveEditorTab,
      loadChatHistoryIntoTab,
      markChatHistoryTabStale,
      handleChatHistoryUpdated,
      ensureChatHistoryTab,
      activateEditorTab,
      activatePairedEditorView,
      openChatHistoryTab,
      closeEditorTab,
      loadPromptIntoTab,
      refreshPromptEditorStatus,
      savePromptTab,
      enterPromptEditMode,
      cancelPromptEditing,
      openPromptTab,
    },
    render: {
      tabs: renderEditorTabs,
      area: renderEditorArea,
      promptSidebarPanel: renderPromptSidebarPanel,
    },
  };
}
