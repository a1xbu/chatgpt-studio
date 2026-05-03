import type { ChatHistoryRecord } from '../../shared/contracts';
import { getChatHistoryRevisionKey } from '../../shared/chat-history-revision';
import type { ChatEditorTab } from '../editor/types';

export type ChatLoaderDependencies = {
  hasProjectFolder: (projectId: string) => boolean;
  getChatHistory: (projectId: string, chatId: string) => Promise<ChatHistoryRecord | null>;
  addDebugLog: (source: 'webview', level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
  countReasoningBlocks: (history: ChatHistoryRecord) => number;
  renderEditorArea: () => void;
};

function clearLoadedChatState(tab: ChatEditorTab, message: string, status: ChatEditorTab['status']): void {
  tab.status = status;
  tab.history = null;
  tab.message = message;
  tab.historyRevisionKey = null;
  tab.pendingHistoryRevisionKey = null;
  tab.isHistoryStale = false;
  tab.renderedContent = null;
  tab.historyScrollTop = null;
}

export function shouldLoadChatHistory(tab: ChatEditorTab, forceReload = false): boolean {
  if (forceReload) {
    return true;
  }

  return tab.status !== 'ready'
    || !tab.history
    || tab.isHistoryStale
    || Boolean(tab.pendingHistoryRevisionKey);
}

function syncLoadedHistoryRevision(tab: ChatEditorTab, loadedHistory: ChatHistoryRecord): boolean {
  const previousRevisionKey = tab.historyRevisionKey;
  const nextRevisionKey = getChatHistoryRevisionKey(loadedHistory);

  tab.historyRevisionKey = nextRevisionKey;
  // We always trust the just-loaded record as the canonical state. If the
  // pending key did not match, that's noise from a divergent in-memory
  // snapshot — drop it instead of triggering another reload, otherwise the
  // tab spins forever when revisionKeys legitimately can't agree.
  tab.pendingHistoryRevisionKey = null;
  tab.isHistoryStale = false;
  return previousRevisionKey !== nextRevisionKey;
}

export async function loadChatHistoryIntoTab(
  tab: ChatEditorTab,
  forceReload = false,
  deps: ChatLoaderDependencies,
): Promise<void> {
  if (!deps.hasProjectFolder(tab.projectId)) {
    clearLoadedChatState(tab, 'Local history is only available for connected projects.', 'empty');
    deps.renderEditorArea();
    return;
  }

  if (!shouldLoadChatHistory(tab, forceReload)) {
    return;
  }

  if (tab.inFlightRequest) {
    if (forceReload || tab.isHistoryStale || Boolean(tab.pendingHistoryRevisionKey)) {
      tab.reloadAfterLoad = true;
    }
    await tab.inFlightRequest;
    return;
  }

  tab.requestToken += 1;
  const requestToken = tab.requestToken;
  if (!tab.history || tab.status === 'empty' || tab.status === 'error') {
    tab.status = 'loading';
    tab.message = null;
    tab.renderedContent = null;
    tab.historyScrollTop = null;
    deps.renderEditorArea();
  }

  const loadPromise = (async () => {
    try {
      const history = await deps.getChatHistory(tab.projectId, tab.chatId);
      if (tab.requestToken !== requestToken) {
        return;
      }

      if (!history) {
        deps.addDebugLog(
          'webview',
          'warn',
          'Local chat history was not found for the opened tab.',
          `projectId=${tab.projectId} chatId=${tab.chatId}`,
        );
        clearLoadedChatState(tab, 'No local history captured for this chat yet.', 'empty');
        deps.renderEditorArea();
        return;
      }

      deps.addDebugLog(
        'webview',
        'info',
        'Loaded local chat history into editor tab.',
        `projectId=${history.projectId} chatId=${history.chatId} messages=${String(history.messages.length)} reasoningBlocks=${String(
          deps.countReasoningBlocks(history),
        )} title=${history.chatName ?? tab.title}`,
      );

      const previousRevisionKey = tab.historyRevisionKey;
      const previousStatus = tab.status;
      const previousMessage = tab.message;
      const previousTitle = tab.title;
      const nextTitle = history.chatName ?? tab.title;
      const nextStatus: ChatEditorTab['status'] = history.messages.length ? 'ready' : 'empty';
      const nextMessage = history.messages.length ? null : 'A snapshot was saved, but it did not contain text messages.';

      tab.history = history;
      tab.title = nextTitle;
      tab.status = nextStatus;
      tab.message = nextMessage;
      const didRevisionAdvance = syncLoadedHistoryRevision(tab, history);
      if (
        previousRevisionKey !== tab.historyRevisionKey
        || previousStatus !== nextStatus
        || previousMessage !== nextMessage
        || previousTitle !== nextTitle
        || didRevisionAdvance
      ) {
        tab.renderedContent = null;
        tab.historyScrollTop = null;
      }
      deps.renderEditorArea();
    } catch (error) {
      if (tab.requestToken !== requestToken) {
        return;
      }

      tab.status = 'error';
      tab.history = null;
      tab.historyRevisionKey = null;
      tab.message = error instanceof Error ? error.message : String(error);
      tab.renderedContent = null;
      tab.historyScrollTop = null;
      deps.renderEditorArea();
    } finally {
      tab.inFlightRequest = null;
      if (tab.reloadAfterLoad) {
        tab.reloadAfterLoad = false;
        void loadChatHistoryIntoTab(tab, true, deps);
      }
    }
  })();

  tab.inFlightRequest = loadPromise;
  await loadPromise;
}
