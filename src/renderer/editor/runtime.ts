import type { ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import { shouldLoadChatHistory } from '../chat/controller';
import {
  activateEditorTab as activateEditorTabState,
  activatePairedEditorView as activatePairedEditorViewState,
  closeEditorTab as closeEditorTabState,
  ensureChatHistoryTab as ensureChatHistoryTabState,
} from './controller';
import type { ChatEditorTab, EditorTabState, PromptEditorTab } from './types';

export type EditorRuntimeState = {
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
};

export type EditorRuntimeStateSetter = (nextState: EditorRuntimeState) => void;

export type EditorRuntimeCallbacks = {
  getPairedChatEditorTab: () => ChatEditorTab | null;
  persistActiveLocalChatSelection: () => void;
  syncSelectionWithActiveEditorTab: () => void;
  render: () => void;
  renderEditorArea: () => void;
  loadChatHistoryIntoTab: (tab: ChatEditorTab, forceReload?: boolean) => Promise<void>;
  loadPromptIntoTab: (tab: PromptEditorTab, forceReload?: boolean) => Promise<void>;
  savePromptTab: (tab: PromptEditorTab) => Promise<void> | void;
};

export type ActivateEditorTabRuntimeOptions = EditorRuntimeCallbacks & {
  tabId: string;
  state: EditorRuntimeState;
  setState: EditorRuntimeStateSetter;
};

export type ActivatePairedEditorViewRuntimeOptions = EditorRuntimeCallbacks & {
  nextView: 'browser' | 'local';
  state: EditorRuntimeState;
  setState: EditorRuntimeStateSetter;
};

export type EnsureChatHistoryTabRuntimeOptions = Pick<EditorRuntimeCallbacks, 'persistActiveLocalChatSelection' | 'syncSelectionWithActiveEditorTab' | 'render' | 'renderEditorArea' | 'loadChatHistoryIntoTab'> & {
  project: SidebarProject;
  chat: ProjectChatRecord;
  activate?: boolean;
  state: EditorRuntimeState;
  setState: EditorRuntimeStateSetter;
  maxOpenChatTabs: number;
};

export type CloseEditorTabRuntimeOptions = EditorRuntimeCallbacks & {
  tabId: string;
  state: EditorRuntimeState;
  setState: EditorRuntimeStateSetter;
};

function isSameEditorRuntimeState(left: EditorRuntimeState, right: EditorRuntimeState): boolean {
  return left.editorTabs === right.editorTabs
    && left.activeEditorTabId === right.activeEditorTabId
    && left.activePairedEditorSubtab === right.activePairedEditorSubtab;
}

function applyEditorRuntimeState(options: {
  currentState: EditorRuntimeState;
  nextState: EditorRuntimeState;
  setState: EditorRuntimeStateSetter;
  persistSelection: boolean;
  syncSelection: boolean;
  renderMode: 'full' | 'editor';
  callbacks: Pick<EditorRuntimeCallbacks, 'persistActiveLocalChatSelection' | 'syncSelectionWithActiveEditorTab' | 'render' | 'renderEditorArea'>;
}): boolean {
  if (isSameEditorRuntimeState(options.currentState, options.nextState)) {
    return false;
  }

  options.setState(options.nextState);

  if (options.persistSelection) {
    options.callbacks.persistActiveLocalChatSelection();
  }

  if (options.syncSelection) {
    options.callbacks.syncSelectionWithActiveEditorTab();
  }

  if (options.renderMode === 'full') {
    options.callbacks.render();
  } else {
    options.callbacks.renderEditorArea();
  }

  return true;
}

export function activateEditorTab(options: ActivateEditorTabRuntimeOptions): void {
  const nextState: EditorRuntimeState = {
    ...options.state,
    ...activateEditorTabState({
      tabId: options.tabId,
    }),
  };

  applyEditorRuntimeState({
    currentState: options.state,
    nextState,
    setState: options.setState,
    persistSelection: true,
    syncSelection: true,
    renderMode: 'full',
    callbacks: options,
  });

  const selectedChatTab = nextState.editorTabs.find((tab): tab is ChatEditorTab => tab.kind === 'chat' && tab.id === nextState.activeEditorTabId) ?? null;
  if (selectedChatTab) {
    if (shouldLoadChatHistory(selectedChatTab)) {
      void options.loadChatHistoryIntoTab(selectedChatTab, false);
    }
    return;
  }

  const selectedPromptTab = nextState.editorTabs.find((tab): tab is PromptEditorTab => tab.kind === 'prompt' && tab.id === nextState.activeEditorTabId) ?? null;
  if (selectedPromptTab) {
    if (selectedPromptTab.status !== 'ready') {
      void options.loadPromptIntoTab(selectedPromptTab, false);
    }
    return;
  }

  if (nextState.activeEditorTabId === 'browser' && nextState.activePairedEditorSubtab === 'local') {
    const pairedTab = options.getPairedChatEditorTab();
    if (pairedTab && shouldLoadChatHistory(pairedTab)) {
      void options.loadChatHistoryIntoTab(pairedTab, false);
    }
  }
}

export function activatePairedEditorView(options: ActivatePairedEditorViewRuntimeOptions): void {
  const nextState: EditorRuntimeState = {
    ...options.state,
    ...activatePairedEditorViewState({
      nextView: options.nextView,
      hasPairedChatTab: Boolean(options.getPairedChatEditorTab()),
    }),
  };

  applyEditorRuntimeState({
    currentState: options.state,
    nextState,
    setState: options.setState,
    persistSelection: true,
    syncSelection: true,
    renderMode: 'full',
    callbacks: options,
  });

  if (nextState.activePairedEditorSubtab === 'local') {
    const pairedTab = options.getPairedChatEditorTab();
    if (pairedTab && shouldLoadChatHistory(pairedTab)) {
      void options.loadChatHistoryIntoTab(pairedTab, false);
    }
  }
}

export async function ensureChatHistoryTab(options: EnsureChatHistoryTabRuntimeOptions): Promise<ChatEditorTab> {
  const result = ensureChatHistoryTabState({
    project: options.project,
    chat: options.chat,
    activate: options.activate,
    editorTabs: options.state.editorTabs,
    activeEditorTabId: options.state.activeEditorTabId,
    activePairedEditorSubtab: options.state.activePairedEditorSubtab,
    maxOpenChatTabs: options.maxOpenChatTabs,
  });

  const nextState: EditorRuntimeState = {
    editorTabs: result.editorTabs,
    activeEditorTabId: result.activeEditorTabId,
    activePairedEditorSubtab: result.activePairedEditorSubtab,
  };

  if (result.didChangeTabs || result.didChangeActiveTab) {
    applyEditorRuntimeState({
      currentState: options.state,
      nextState,
      setState: options.setState,
      persistSelection: result.didChangeActiveTab,
      syncSelection: result.didChangeActiveTab,
      renderMode: result.didChangeActiveTab ? 'full' : 'editor',
      callbacks: options,
    });
  }

  if (shouldLoadChatHistory(result.tab)) {
    await options.loadChatHistoryIntoTab(result.tab, false);
  }
  return result.tab;
}

export function closeEditorTab(options: CloseEditorTabRuntimeOptions): void {
  const result = closeEditorTabState({
    tabId: options.tabId,
    editorTabs: options.state.editorTabs,
    activeEditorTabId: options.state.activeEditorTabId,
    activePairedEditorSubtab: options.state.activePairedEditorSubtab,
  });

  if (!result.didChangeTabs) {
    return;
  }

  const nextState: EditorRuntimeState = {
    editorTabs: result.editorTabs,
    activeEditorTabId: result.activeEditorTabId,
    activePairedEditorSubtab: result.activePairedEditorSubtab,
  };

  applyEditorRuntimeState({
    currentState: options.state,
    nextState,
    setState: options.setState,
    persistSelection: result.didChangeActiveTab,
    syncSelection: result.didChangeActiveTab,
    renderMode: result.didChangeActiveTab ? 'full' : 'editor',
    callbacks: options,
  });

  if (result.tabToSave) {
    void options.savePromptTab(result.tabToSave);
  }
}
