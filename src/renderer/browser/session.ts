
import type { AppStateSnapshot, DebugLogEntry, ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import type { SidebarSelection } from '../sidebar/types';

export type BrowserSessionSelectionOptions = {
  selectedSidebarItem: SidebarSelection | null;
  loadLastBrowserOpenedSelection: () => SidebarSelection | null;
  loadLastActiveLocalChatSelection: () => SidebarSelection | null;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
};

export type BrowserSessionUrlOptions = BrowserSessionSelectionOptions & {
  resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
  resolveProjectBrowserUrl: (project: SidebarProject) => string;
  defaultUrl?: string;
};

export type BrowserOpenedSelectionOptions = {
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
};

export type SyncBrowserOpenedSelectionOptions = BrowserOpenedSelectionOptions & {
  browserIsLoading: boolean;
  browserOpenedSidebarItem: SidebarSelection | null;
  setBrowserOpenedSidebarItem: (selection: SidebarSelection | null) => void;
  persistBrowserOpenedSelection: () => void;
  getPairedChatSelection: () => Extract<SidebarSelection, { kind: 'chat' }> | null;
  ensureChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord, activate?: boolean) => Promise<unknown>;
  addDebugLog: (source: DebugLogEntry['source'], level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
};

export type RestoreLastOpenStateOptions = BrowserSessionUrlOptions & {
  hasRestoredLastOpenState: boolean;
  setHasRestoredLastOpenState: (value: boolean) => void;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  setBrowserOpenedSidebarItem: (selection: SidebarSelection | null) => void;
  persistBrowserOpenedSelection: () => void;
  openBrowserUrl: (url: string, options?: { activate?: boolean }) => void;
  openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => Promise<unknown>;
};

export function resolvePreferredStartupBrowserSelection(
  state: AppStateSnapshot,
  options: BrowserSessionSelectionOptions,
): SidebarSelection | null {
  const lastBrowserSelection = options.loadLastBrowserOpenedSelection();
  const lastActiveSelection = options.loadLastActiveLocalChatSelection();
  const lastActiveLocalChat: Extract<SidebarSelection, { kind: 'chat' }> | null = lastActiveSelection?.kind === 'chat'
    ? lastActiveSelection
    : null;

  const browserSelection = options.selectedSidebarItem?.kind === 'chat'
    ? options.selectedSidebarItem
    : options.selectedSidebarItem?.kind === 'project'
      ? options.selectedSidebarItem
      : lastActiveLocalChat
        ? lastActiveLocalChat
        : lastBrowserSelection;

  if (browserSelection?.kind === 'chat') {
    const project = options.findSidebarProject(state, browserSelection.projectId);
    const chat = project ? options.findSidebarChat(state, browserSelection.projectId, browserSelection.chatId) : null;
    return project && chat ? browserSelection : null;
  }

  if (browserSelection?.kind === 'project') {
    const project = options.findSidebarProject(state, browserSelection.projectId);
    return project ? browserSelection : null;
  }

  return null;
}

export function resolvePreferredStartupBrowserUrl(
  state: AppStateSnapshot,
  options: BrowserSessionUrlOptions,
): string {
  const browserSelection = resolvePreferredStartupBrowserSelection(state, options);
  if (browserSelection?.kind === 'chat') {
    const project = options.findSidebarProject(state, browserSelection.projectId);
    const chat = project ? options.findSidebarChat(state, browserSelection.projectId, browserSelection.chatId) : null;
    if (project && chat) {
      return options.resolveChatBrowserUrl(project, chat);
    }
  }

  if (browserSelection?.kind === 'project') {
    const project = options.findSidebarProject(state, browserSelection.projectId);
    if (project) {
      return options.resolveProjectBrowserUrl(project);
    }
  }

  return options.defaultUrl ?? 'https://chatgpt.com';
}

export function resolveBrowserOpenedSelection(
  state: AppStateSnapshot,
  options: BrowserOpenedSelectionOptions,
): SidebarSelection | null {
  const currentProjectId = state.lastContext?.currentProjectId ?? null;
  const currentChatId = state.lastContext?.currentChatId ?? null;

  if (currentProjectId && currentChatId && options.findSidebarChat(state, currentProjectId, currentChatId)) {
    return {
      kind: 'chat',
      projectId: currentProjectId,
      chatId: currentChatId,
    };
  }

  if (currentProjectId && options.findSidebarProject(state, currentProjectId)) {
    return {
      kind: 'project',
      projectId: currentProjectId,
    };
  }

  return null;
}

export function syncBrowserOpenedSelection(
  state: AppStateSnapshot,
  options: SyncBrowserOpenedSelectionOptions,
): void {
  const previousSerialized = JSON.stringify(options.browserOpenedSidebarItem);
  const actualSelection = resolveBrowserOpenedSelection(state, options);

  if (options.browserIsLoading && options.browserOpenedSidebarItem) {
    return;
  }

  if (actualSelection) {
    options.setBrowserOpenedSidebarItem(actualSelection);
  } else if (
    options.browserOpenedSidebarItem?.kind === 'project' &&
    !options.findSidebarProject(state, options.browserOpenedSidebarItem.projectId)
  ) {
    options.setBrowserOpenedSidebarItem(null);
  } else if (
    options.browserOpenedSidebarItem?.kind === 'chat' &&
    !options.findSidebarChat(state, options.browserOpenedSidebarItem.projectId, options.browserOpenedSidebarItem.chatId)
  ) {
    options.setBrowserOpenedSidebarItem(null);
  }

  if (JSON.stringify(options.browserOpenedSidebarItem) !== previousSerialized) {
    options.persistBrowserOpenedSelection();
  }

  const pairedSelection = options.getPairedChatSelection();
  if (pairedSelection) {
    const project = options.findSidebarProject(state, pairedSelection.projectId);
    const chat = project ? options.findSidebarChat(state, pairedSelection.projectId, pairedSelection.chatId) : null;
    if (project && chat) {
      void options.ensureChatHistoryTab(project, chat, false).catch((error: unknown) => {
        options.addDebugLog('webview', 'error', 'Failed to sync paired local chat tab.', error instanceof Error ? error.message : String(error));
      });
    }
  }
}

export async function restoreLastOpenState(
  state: AppStateSnapshot,
  options: RestoreLastOpenStateOptions,
): Promise<void> {
  if (options.hasRestoredLastOpenState) {
    return;
  }

  options.setHasRestoredLastOpenState(true);

  const lastActiveSelection = options.loadLastActiveLocalChatSelection();
  const lastActiveLocalChat: Extract<SidebarSelection, { kind: 'chat' }> | null = lastActiveSelection?.kind === 'chat'
    ? lastActiveSelection
    : null;
  const selectedSidebarItem = options.selectedSidebarItem;

  if (selectedSidebarItem?.kind === 'project') {
    const selectedProject = options.findPersistentSidebarProject(state, selectedSidebarItem.projectId)
      ?? options.findSidebarProject(state, selectedSidebarItem.projectId);
    if (!selectedProject) {
      options.setSelectedSidebarItem(null);
    }
  } else if (selectedSidebarItem?.kind === 'chat') {
    const selectedProject = options.findPersistentSidebarProject(state, selectedSidebarItem.projectId)
      ?? options.findSidebarProject(state, selectedSidebarItem.projectId);
    const selectedChat = selectedProject ? options.findSidebarChat(state, selectedSidebarItem.projectId, selectedSidebarItem.chatId) : null;
    if (!(selectedProject && selectedChat)) {
      options.setSelectedSidebarItem(null);
    }
  } else if (lastActiveLocalChat) {
    const selectedProject = options.findPersistentSidebarProject(state, lastActiveLocalChat.projectId)
      ?? options.findSidebarProject(state, lastActiveLocalChat.projectId);
    const selectedChat = selectedProject ? options.findSidebarChat(state, lastActiveLocalChat.projectId, lastActiveLocalChat.chatId) : null;
    if (selectedProject && selectedChat) {
      options.setSelectedSidebarItem({ kind: 'chat', projectId: selectedProject.projectId, chatId: selectedChat.chatId });
    }
  }

  const browserSelection = resolvePreferredStartupBrowserSelection(state, options);
  if (browserSelection?.kind === 'chat') {
    const project = options.findSidebarProject(state, browserSelection.projectId);
    const chat = project ? options.findSidebarChat(state, browserSelection.projectId, browserSelection.chatId) : null;
    if (project && chat) {
      options.setBrowserOpenedSidebarItem(browserSelection);
      options.persistBrowserOpenedSelection();
      options.openBrowserUrl(options.resolveChatBrowserUrl(project, chat), { activate: false });
    }
  } else if (browserSelection?.kind === 'project') {
    const project = options.findSidebarProject(state, browserSelection.projectId);
    if (project) {
      options.setBrowserOpenedSidebarItem(browserSelection);
      options.persistBrowserOpenedSelection();
      options.openBrowserUrl(options.resolveProjectBrowserUrl(project), { activate: false });
    }
  }

  if (!lastActiveLocalChat) {
    return;
  }

  const project = options.findPersistentSidebarProject(state, lastActiveLocalChat.projectId)
    ?? options.findSidebarProject(state, lastActiveLocalChat.projectId);
  const chat = project ? options.findSidebarChat(state, lastActiveLocalChat.projectId, lastActiveLocalChat.chatId) : null;
  if (project && chat) {
    await options.openChatHistoryTab(project, chat);
  }
}
