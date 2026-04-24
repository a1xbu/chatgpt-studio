import type { AppStateSnapshot, ProjectChatRecord, PromptRecord, SidebarProject } from '../../shared/contracts';
import type { SidebarSelection } from '../sidebar/types';
import type { BrowserEditorTab, ChatEditorTab, EditorTabState, PromptEditorTab } from './types';

export function getChatEditorTabId(projectId: string, chatId: string): string {
  return `chat:${projectId}:${chatId}`;
}

export function getPromptEditorTabId(promptId: string): string {
  return `prompt:${promptId}`;
}

export function findChatEditorTab(
  editorTabs: readonly EditorTabState[],
  projectId: string,
  chatId: string,
): ChatEditorTab | null {
  const tabId = getChatEditorTabId(projectId, chatId);
  const tab = editorTabs.find((candidate): candidate is ChatEditorTab => candidate.kind === 'chat' && candidate.id === tabId);
  return tab ?? null;
}

export function findPromptEditorTab(
  editorTabs: readonly EditorTabState[],
  promptId: string,
): PromptEditorTab | null {
  const tabId = getPromptEditorTabId(promptId);
  const tab = editorTabs.find((candidate): candidate is PromptEditorTab => candidate.kind === 'prompt' && candidate.id === tabId);
  return tab ?? null;
}

export type NormalizeEditorTabsStateOptions = {
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  currentState: AppStateSnapshot | null;
  prompts: PromptRecord[];
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  maxOpenChatTabs: number;
  maxOpenPromptTabs: number;
};

function trimChatEditorTabs(
  editorTabs: EditorTabState[],
  activeEditorTabId: string,
  maxOpenChatTabs: number,
): { editorTabs: EditorTabState[]; activeEditorTabId: string } {
  const chatTabs = editorTabs.filter((tab): tab is ChatEditorTab => tab.kind === 'chat');
  if (chatTabs.length <= maxOpenChatTabs) {
    return { editorTabs, activeEditorTabId };
  }

  const tabsToDrop = chatTabs.slice(0, chatTabs.length - maxOpenChatTabs);
  const idsToDrop = new Set(tabsToDrop.map((tab) => tab.id));
  const nextTabs = editorTabs.filter((tab) => !idsToDrop.has(tab.id));
  const nextActiveEditorTabId = nextTabs.some((tab) => tab.id === activeEditorTabId)
    ? activeEditorTabId
    : chatTabs[chatTabs.length - 1]?.id ?? 'browser';

  return {
    editorTabs: nextTabs,
    activeEditorTabId: nextActiveEditorTabId,
  };
}

function trimPromptEditorTabs(
  editorTabs: EditorTabState[],
  activeEditorTabId: string,
  maxOpenPromptTabs: number,
): { editorTabs: EditorTabState[]; activeEditorTabId: string } {
  const promptTabs = editorTabs.filter((tab): tab is PromptEditorTab => tab.kind === 'prompt');
  if (promptTabs.length <= maxOpenPromptTabs) {
    return { editorTabs, activeEditorTabId };
  }

  const tabsToDrop = promptTabs.slice(0, promptTabs.length - maxOpenPromptTabs);
  const idsToDrop = new Set(tabsToDrop.map((tab) => tab.id));
  const nextTabs = editorTabs.filter((tab) => !idsToDrop.has(tab.id));
  const nextActiveEditorTabId = nextTabs.some((tab) => tab.id === activeEditorTabId)
    ? activeEditorTabId
    : promptTabs[promptTabs.length - 1]?.id ?? 'browser';

  return {
    editorTabs: nextTabs,
    activeEditorTabId: nextActiveEditorTabId,
  };
}

export function normalizeEditorTabsState(
  options: NormalizeEditorTabsStateOptions,
): { editorTabs: EditorTabState[]; activeEditorTabId: string } {
  const browserTab = options.editorTabs.find((tab): tab is BrowserEditorTab => tab.kind === 'browser') ?? {
    id: 'browser' as const,
    kind: 'browser' as const,
    title: 'Browser',
  };

  const nextTabs: EditorTabState[] = [browserTab];
  for (const tab of options.editorTabs) {
    if (tab.kind === 'chat') {
      const project = options.currentState ? options.findSidebarProject(options.currentState, tab.projectId) : null;
      if (options.currentState && !project) {
        continue;
      }

      if (project && project.status !== 'persistent') {
        continue;
      }

      const sidebarChat = options.currentState ? options.findSidebarChat(options.currentState, tab.projectId, tab.chatId) : null;
      const nextTitle = tab.history?.chatName ?? sidebarChat?.chatName ?? tab.title;
      if (nextTitle !== tab.title) {
        tab.title = nextTitle;
        tab.renderedContent = null;
      }
      nextTabs.push(tab);
      continue;
    }

    if (tab.kind === 'prompt') {
      const promptRecord = options.prompts.find((entry) => entry.id === tab.promptId) ?? null;
      if (!promptRecord) {
        continue;
      }

      tab.promptRecord = promptRecord;
      tab.title = promptRecord.title;
      tab.promptPath = promptRecord.fullPath;
      nextTabs.push(tab);
    }
  }

  let normalized = {
    editorTabs: nextTabs,
    activeEditorTabId: nextTabs.some((tab) => tab.id === options.activeEditorTabId) ? options.activeEditorTabId : 'browser',
  };

  normalized = trimChatEditorTabs(normalized.editorTabs, normalized.activeEditorTabId, options.maxOpenChatTabs);
  normalized = trimPromptEditorTabs(normalized.editorTabs, normalized.activeEditorTabId, options.maxOpenPromptTabs);
  if (!normalized.editorTabs.some((tab) => tab.id === normalized.activeEditorTabId)) {
    normalized.activeEditorTabId = 'browser';
  }

  return normalized;
}

export function updateEditorTabBarLayout(options: {
  editorTabsElement: HTMLElement | null;
  editorTabs: readonly EditorTabState[];
  pairedSelection: Extract<SidebarSelection, { kind: 'chat' }> | null;
  editorTabBaseWidthPx: number;
  editorTabMinWidthPx: number;
}): void {
  if (!options.editorTabsElement) {
    return;
  }

  const visibleTabCount = Math.max(
    options.editorTabs.filter((tab) => {
      if (tab.kind === 'browser') {
        return true;
      }
      if (tab.kind === 'chat') {
        return !(options.pairedSelection && tab.projectId === options.pairedSelection.projectId && tab.chatId === options.pairedSelection.chatId);
      }
      return tab.kind === 'prompt';
    }).length,
    1,
  );
  options.editorTabsElement.style.setProperty('--editor-visible-tab-count', String(visibleTabCount));
  options.editorTabsElement.style.setProperty('--editor-tab-base-width', `${String(options.editorTabBaseWidthPx)}px`);
  options.editorTabsElement.style.setProperty('--editor-tab-min-width', `${String(options.editorTabMinWidthPx)}px`);
}

export function resolveSelectionForActiveEditorTab(options: {
  activeEditorTabId: string;
  editorTabs: readonly EditorTabState[];
  browserOpenedSidebarItem: SidebarSelection | null;
  selectedSidebarItem: SidebarSelection | null;
  pairedSelection: Extract<SidebarSelection, { kind: 'chat' }> | null;
}): SidebarSelection | null {
  if (options.activeEditorTabId === 'browser') {
    if (options.pairedSelection) {
      return options.pairedSelection;
    }

    return options.browserOpenedSidebarItem;
  }

  const activeChatTab = options.editorTabs.find((tab): tab is ChatEditorTab => tab.kind === 'chat' && tab.id === options.activeEditorTabId) ?? null;
  if (!activeChatTab) {
    return options.selectedSidebarItem?.kind === 'chat' || options.selectedSidebarItem?.kind === 'project' ? options.selectedSidebarItem : null;
  }

  return {
    kind: 'chat',
    projectId: activeChatTab.projectId,
    chatId: activeChatTab.chatId,
  };
}

export type EnsureChatHistoryTabOptions = {
  project: SidebarProject;
  chat: ProjectChatRecord;
  activate?: boolean;
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
  maxOpenChatTabs: number;
};

export type EnsureChatHistoryTabResult = {
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
  tab: ChatEditorTab;
  didChangeTabs: boolean;
  didChangeActiveTab: boolean;
};

export function ensureChatHistoryTab(
  options: EnsureChatHistoryTabOptions,
): EnsureChatHistoryTabResult {
  const existingTab = findChatEditorTab(options.editorTabs, options.project.projectId, options.chat.chatId);
  if (existingTab) {
    existingTab.title = existingTab.history?.chatName ?? options.chat.chatName ?? existingTab.title;
    const activeEditorTabId = options.activate ? existingTab.id : options.activeEditorTabId;
    const activePairedEditorSubtab = options.activate ? 'local' : options.activePairedEditorSubtab;
    const didChangeActiveTab = Boolean(options.activate
      && (activeEditorTabId !== options.activeEditorTabId || activePairedEditorSubtab !== options.activePairedEditorSubtab));
    return {
      editorTabs: options.editorTabs,
      activeEditorTabId,
      activePairedEditorSubtab,
      tab: existingTab,
      didChangeTabs: false,
      didChangeActiveTab,
    };
  }

  const nextTab: ChatEditorTab = {
    id: getChatEditorTabId(options.project.projectId, options.chat.chatId),
    kind: 'chat',
    projectId: options.project.projectId,
    chatId: options.chat.chatId,
    title: options.chat.chatName,
    status: 'loading',
    history: null,
    message: null,
    requestToken: 0,
    inFlightRequest: null,
    reloadAfterLoad: false,
    historyRevisionKey: null,
    pendingHistoryRevisionKey: null,
    isHistoryStale: false,
    renderedContent: null,
    historyScrollTop: null,
  };

  const chatTabs = options.editorTabs.filter((tab): tab is ChatEditorTab => tab.kind === 'chat');
  const retainedChatTabs = chatTabs.slice(-(options.maxOpenChatTabs - 1));
  const browserTab = options.editorTabs.find((tab): tab is BrowserEditorTab => tab.kind === 'browser') ?? {
    id: 'browser' as const,
    kind: 'browser' as const,
    title: 'Browser',
  };
  const nonChatTabs = options.editorTabs.filter((tab) => tab.kind !== 'browser' && tab.kind !== 'chat');

  const editorTabs = [browserTab, ...nonChatTabs, ...retainedChatTabs, nextTab];
  const activeEditorTabId = options.activate ? nextTab.id : options.activeEditorTabId;
  const activePairedEditorSubtab = options.activate ? 'local' : options.activePairedEditorSubtab;
  const didChangeActiveTab = Boolean(options.activate
    && (activeEditorTabId !== options.activeEditorTabId || activePairedEditorSubtab !== options.activePairedEditorSubtab));
  return {
    editorTabs,
    activeEditorTabId,
    activePairedEditorSubtab,
    tab: nextTab,
    didChangeTabs: true,
    didChangeActiveTab,
  };
}

export type ActivateEditorTabOptions = {
  tabId: string;
};

export function activateEditorTab(options: ActivateEditorTabOptions): {
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
} {
  return {
    activeEditorTabId: options.tabId === 'browser' ? 'browser' : options.tabId,
    activePairedEditorSubtab: options.tabId === 'browser' ? 'browser' : 'local',
  };
}

export type ActivatePairedEditorViewOptions = {
  nextView: 'browser' | 'local';
  hasPairedChatTab: boolean;
};

export function activatePairedEditorView(options: ActivatePairedEditorViewOptions): {
  activeEditorTabId: 'browser';
  activePairedEditorSubtab: 'browser' | 'local';
} {
  if (options.nextView === 'local' && !options.hasPairedChatTab) {
    return {
      activeEditorTabId: 'browser',
      activePairedEditorSubtab: 'browser',
    };
  }

  return {
    activeEditorTabId: 'browser',
    activePairedEditorSubtab: options.nextView,
  };
}

export type CloseEditorTabOptions = {
  tabId: string;
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
};

export type CloseEditorTabResult = {
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
  tabToSave: PromptEditorTab | null;
  didChangeTabs: boolean;
  didChangeActiveTab: boolean;
};

export function closeEditorTab(options: CloseEditorTabOptions): CloseEditorTabResult {
  if (options.tabId === 'browser') {
    return {
      editorTabs: options.editorTabs,
      activeEditorTabId: options.activeEditorTabId,
      activePairedEditorSubtab: options.activePairedEditorSubtab,
      tabToSave: null,
      didChangeTabs: false,
      didChangeActiveTab: false,
    };
  }

  const closingIndex = options.editorTabs.findIndex((tab) => tab.id === options.tabId);
  if (closingIndex < 0) {
    return {
      editorTabs: options.editorTabs,
      activeEditorTabId: options.activeEditorTabId,
      activePairedEditorSubtab: options.activePairedEditorSubtab,
      tabToSave: null,
      didChangeTabs: false,
      didChangeActiveTab: false,
    };
  }

  const closingTab = options.editorTabs[closingIndex];
  const tabToSave = closingTab?.kind === 'prompt' && closingTab.isDirty ? closingTab : null;
  const editorTabs = options.editorTabs.filter((tab) => tab.id !== options.tabId);
  if (options.activeEditorTabId !== options.tabId) {
    return {
      editorTabs,
      activeEditorTabId: options.activeEditorTabId,
      activePairedEditorSubtab: options.activePairedEditorSubtab,
      tabToSave,
      didChangeTabs: true,
      didChangeActiveTab: false,
    };
  }

  const fallbackTab = editorTabs[closingIndex] ?? editorTabs[closingIndex - 1] ?? editorTabs[0] ?? { id: 'browser' as const };
  return {
    editorTabs,
    activeEditorTabId: fallbackTab.id,
    activePairedEditorSubtab: fallbackTab.id === 'browser' ? 'browser' : 'local',
    tabToSave,
    didChangeTabs: true,
    didChangeActiveTab: true,
  };
}
