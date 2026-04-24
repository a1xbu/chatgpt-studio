import type { AppStateSnapshot, DebugLogEntry, ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import type { BrowserController } from '../browser/controller';
import type { ChatEditorTab } from '../editor/types';
import type { SidebarSelection } from '../sidebar/types';

export function getPairedChatSelection(
  browserOpenedSidebarItem: SidebarSelection | null,
): Extract<SidebarSelection, { kind: 'chat' }> | null {
  return browserOpenedSidebarItem?.kind === 'chat' ? browserOpenedSidebarItem : null;
}

export function getPairedChatEditorTab(options: {
  browserOpenedSidebarItem: SidebarSelection | null;
  findChatEditorTab: (projectId: string, chatId: string) => ChatEditorTab | null;
}): ChatEditorTab | null {
  const pairedSelection = getPairedChatSelection(options.browserOpenedSidebarItem);
  if (!pairedSelection) {
    return null;
  }

  return options.findChatEditorTab(pairedSelection.projectId, pairedSelection.chatId);
}

export function isBrowserPairedWithChat(
  browserOpenedSidebarItem: SidebarSelection | null,
  projectId: string,
  chatId: string,
): boolean {
  return browserOpenedSidebarItem?.kind === 'chat'
    && browserOpenedSidebarItem.projectId === projectId
    && browserOpenedSidebarItem.chatId === chatId;
}

export type OpenBrowserForPairedChatOptions = {
  currentState: AppStateSnapshot | null;
  projectId: string;
  chatId: string;
  activateBrowser?: boolean;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  ensureChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord, activate?: boolean) => Promise<unknown>;
  addDebugLog: (source: DebugLogEntry['source'], level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
  setBrowserOpenedSidebarItem: (selection: SidebarSelection | null) => void;
  setActivePairedEditorSubtab: (value: 'browser' | 'local') => void;
  persistBrowserOpenedSelection: () => void;
  browserController: Pick<BrowserController, 'openUrl'>;
  resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
  renderEditorArea: () => void;
};

export function openBrowserForPairedChat(options: OpenBrowserForPairedChatOptions): boolean {
  if (!options.currentState) {
    return false;
  }

  const project = options.findSidebarProject(options.currentState, options.projectId);
  const chat = project ? options.findSidebarChat(options.currentState, options.projectId, options.chatId) : null;
  if (!project || !chat) {
    return false;
  }

  void options.ensureChatHistoryTab(project, chat, false).catch((error: unknown) => {
    options.addDebugLog(
      'webview',
      'error',
      'Failed to prepare paired local chat tab.',
      error instanceof Error ? error.message : String(error),
    );
  });

  options.setBrowserOpenedSidebarItem({
    kind: 'chat',
    projectId: options.projectId,
    chatId: options.chatId,
  });
  options.setActivePairedEditorSubtab('browser');
  options.persistBrowserOpenedSelection();
  options.browserController.openUrl(options.resolveChatBrowserUrl(project, chat), { activate: options.activateBrowser });
  if (!options.activateBrowser) {
    options.renderEditorArea();
  }
  return true;
}

export type OpenLocalChatInChatGptOptions = {
  projectId: string;
  chatId: string;
  chatUrl: string;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  isBrowserPairedWithChat: (projectId: string, chatId: string) => boolean;
  setActiveEditorTabId: (tabId: string) => void;
  setActivePairedEditorSubtab: (value: 'browser' | 'local') => void;
  renderEditorArea: () => void;
  openBrowserForPairedChat: (projectId: string, chatId: string, activateBrowser?: boolean) => boolean;
  activateEditorTab: (tabId: string) => void;
  browserController: Pick<BrowserController, 'openUrl'>;
};

export function openLocalChatInChatGpt(options: OpenLocalChatInChatGptOptions): void {
  if (options.projectId && options.chatId) {
    options.setSelectedSidebarItem({ kind: 'chat', projectId: options.projectId, chatId: options.chatId });
  }

  if (options.projectId && options.chatId && options.isBrowserPairedWithChat(options.projectId, options.chatId)) {
    options.setActiveEditorTabId('browser');
    options.setActivePairedEditorSubtab('browser');
    options.renderEditorArea();
    return;
  }

  if (options.projectId && options.chatId && options.openBrowserForPairedChat(options.projectId, options.chatId, true)) {
    return;
  }

  options.setActivePairedEditorSubtab('browser');
  options.activateEditorTab('browser');
  options.browserController.openUrl(options.chatUrl);
}

