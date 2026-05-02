import type { ChatFileRecord, ChatHistoryMessageRecord, ChatHistoryReasoningStep, ChatHistoryRecord } from '../../shared/contracts';
import type { DesktopPocApi } from '../desktop-api';
import { createJsonTreeView, type JsonTreeValue } from './json-tree';
import { createChatMarkdownView } from './markdown-view';

export type ChatHistoryViewMode = 'markdown' | 'raw-json';

export type ChatEditorTabState = {
  id: string;
  title: string;
  projectId: string;
  chatId: string;
  status: 'loading' | 'ready' | 'empty' | 'error';
  history: ChatHistoryRecord | null;
  message: string | null;
  viewMode?: ChatHistoryViewMode;
  branchOverrides?: Map<string, string> | null;
};

export type ChatHistoryHelpers = {
  formatTimestamp: (value: string | null | undefined) => string;
  formatFileSize: (sizeBytes: number | null | undefined) => string;
  formatChatMessageRole: (role: ChatHistoryMessageRecord['role']) => string;
  formatChatMessageTimestamp: (message: ChatHistoryMessageRecord) => string;
  renderMessageMarkdown: (message: ChatHistoryMessageRecord) => string;
  renderMarkdown: (markdown: string) => string;
  renderGenericFileIcon: () => string;
  loadMessageThoughts?: (messageId: string) => Promise<ChatHistoryReasoningStep[]>;
};

export function createChatHistoryEmptyState(message: string): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'chat-history-empty';
  element.textContent = message;
  return element;
}

export function countReasoningBlocks(history: ChatHistoryRecord | null): number {
  if (!history) {
    return 0;
  }

  let count = 0;
  let currentTurnHasThinking = false;
  for (const message of history.messages) {
    if (message.role === 'user') {
      if (currentTurnHasThinking) {
        count += 1;
      }
      currentTurnHasThinking = false;
      continue;
    }

    if (message.role === 'assistant' && (message.contentType === 'text' || message.contentType === 'multimodal_text')) {
      continue;
    }

    if (message.text || message.contentType === 'reasoning_recap') {
      currentTurnHasThinking = true;
    }
  }

  if (currentTurnHasThinking) {
    count += 1;
  }
  return count;
}

function getChatHistoryViewMode(tab: ChatEditorTabState): ChatHistoryViewMode {
  return tab.viewMode === 'raw-json' ? 'raw-json' : 'markdown';
}

function formatRawChatHistoryJson(history: ChatHistoryRecord): string {
  return JSON.stringify(history, null, 2);
}

function createChatHistoryViewToggle(
  currentMode: ChatHistoryViewMode,
  onChange: (mode: ChatHistoryViewMode) => void,
): HTMLElement {
  const toggle = document.createElement('div');
  toggle.className = 'chat-history-view-toggle';
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', 'Chat history display mode');

  const modes: Array<{ mode: ChatHistoryViewMode; label: string }> = [
    { mode: 'markdown', label: 'Markdown' },
    { mode: 'raw-json', label: 'JSON tree' },
  ];

  const buttons = new Map<ChatHistoryViewMode, HTMLButtonElement>();
  const syncButtons = (activeMode: ChatHistoryViewMode): void => {
    for (const { mode } of modes) {
      const button = buttons.get(mode);
      if (!button) {
        continue;
      }
      const isActive = mode === activeMode;
      button.classList.toggle('chat-history-view-toggle__button--active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  };

  for (const { mode, label } of modes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-history-view-toggle__button';
    button.textContent = label;
    button.addEventListener('click', () => {
      syncButtons(mode);
      onChange(mode);
    });
    buttons.set(mode, button);
    toggle.append(button);
  }

  syncButtons(currentMode);
  return toggle;
}

function setChatHistoryViewMode(
  tab: ChatEditorTabState,
  shell: HTMLElement,
  markdownPanel: HTMLElement,
  jsonTreePanel: HTMLElement,
  mode: ChatHistoryViewMode,
): void {
  tab.viewMode = mode;
  const showJsonTree = mode === 'raw-json';
  shell.classList.toggle('chat-history-shell--raw-json', showJsonTree);
  markdownPanel.hidden = showJsonTree;
  jsonTreePanel.hidden = !showJsonTree;
}

function sanitizeDownloadFileName(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || 'chat-history';
}

function createSaveJsonButton(history: ChatHistoryRecord): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chat-history-save-json';
  button.textContent = 'Save as…';
  button.title = 'Save full chat history as formatted JSON';

  const defaultFileName = `${sanitizeDownloadFileName(history.chatName ?? history.chatId)}.json`;
  button.addEventListener('click', () => {
    const api = (window as Window & { desktopPoc?: Pick<DesktopPocApi, 'saveChatHistoryJson'> }).desktopPoc;
    if (!api?.saveChatHistoryJson) {
      button.textContent = 'Save unavailable';
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving…';
    void api.saveChatHistoryJson(defaultFileName, formatRawChatHistoryJson(history)).then((result) => {
      button.disabled = false;
      button.textContent = result.saved ? 'Saved' : 'Save as…';
      window.setTimeout(() => {
        button.textContent = 'Save as…';
      }, result.saved ? 1400 : 0);
    }).catch(() => {
      button.disabled = false;
      button.textContent = 'Save failed';
      window.setTimeout(() => {
        button.textContent = 'Save as…';
      }, 1800);
    });
  });

  return button;
}

function createChatHistoryHeader(options: {
  tab: ChatEditorTabState;
  history: ChatHistoryRecord;
  metaParts: readonly string[];
  initialViewMode: ChatHistoryViewMode;
  shell: HTMLElement;
  markdownPanel: HTMLElement;
  jsonTreePanel: HTMLElement;
}): HTMLElement {
  const header = document.createElement('div');
  header.className = 'chat-history-header';

  const headerTop = document.createElement('div');
  headerTop.className = 'chat-history-header__top';

  const title = document.createElement('h2');
  title.className = 'chat-history-header__title';
  title.textContent = options.history.chatName ?? options.tab.title;
  headerTop.append(title);

  const controls = document.createElement('div');
  controls.className = 'chat-history-header__controls';
  controls.append(createSaveJsonButton(options.history));
  controls.append(createChatHistoryViewToggle(options.initialViewMode, (mode) => {
    setChatHistoryViewMode(options.tab, options.shell, options.markdownPanel, options.jsonTreePanel, mode);
  }));
  headerTop.append(controls);
  header.append(headerTop);

  const meta = document.createElement('div');
  meta.className = 'chat-history-header__meta';
  for (const entry of options.metaParts) {
    const item = document.createElement('span');
    item.textContent = entry;
    meta.append(item);
  }
  header.append(meta);

  return header;
}

export function createChatHistoryTabContent(
  tab: ChatEditorTabState,
  _chatUrl: string,
  helpers: ChatHistoryHelpers,
): HTMLElement {
  if (tab.status === 'loading') {
    return createChatHistoryEmptyState('Loading chat history from the local project database...');
  }

  if (tab.status === 'error') {
    return createChatHistoryEmptyState(tab.message ?? 'Unable to load the local chat history.');
  }

  if (tab.status === 'empty' || !tab.history) {
    return createChatHistoryEmptyState(tab.message ?? 'No local history captured for this chat yet.');
  }

  const history = tab.history;
  const metaParts = [
    history.projectName ? `Project: ${history.projectName}` : null,
    `${history.messageCount} messages`,
    `Updated: ${helpers.formatTimestamp(history.updatedAt ?? history.capturedAt)}`,
    `Captured: ${helpers.formatTimestamp(history.capturedAt)}`,
  ].filter((entry): entry is string => Boolean(entry));

  const shell = document.createElement('div');
  shell.className = 'chat-history-shell';
  const initialViewMode = getChatHistoryViewMode(tab);

  if (!tab.branchOverrides) {
    tab.branchOverrides = new Map<string, string>();
  }
  const overridesRef = { value: tab.branchOverrides };

  const markdownPanel = createChatMarkdownView(history, helpers, createChatHistoryEmptyState, overridesRef);
  const jsonTreePanel = createJsonTreeView(parseSnapshotForJsonView(history), { rootLabel: 'snapshot' });

  shell.append(createChatHistoryHeader({
    tab,
    history,
    metaParts,
    initialViewMode,
    shell,
    markdownPanel,
    jsonTreePanel,
  }));

  shell.append(markdownPanel, jsonTreePanel);
  setChatHistoryViewMode(tab, shell, markdownPanel, jsonTreePanel, initialViewMode);

  return shell;
}

function parseSnapshotForJsonView(history: ChatHistoryRecord): JsonTreeValue {
  if (history.snapshotJson) {
    try {
      return JSON.parse(history.snapshotJson) as JsonTreeValue;
    } catch {
      // fall through
    }
  }
  // Fallback: synthesize a snapshot-shaped object from the message records.
  const mapping: Record<string, JsonTreeValue> = {};
  for (const message of history.messages) {
    const key = message.nodeId ?? message.messageId ?? '';
    if (!key) {
      continue;
    }
    mapping[key] = {
      id: message.nodeId ?? null,
      message: {
        id: message.messageId ?? null,
        author: { role: message.role, name: message.authorName ?? null },
        create_time: message.createdAt,
        update_time: message.updatedAt,
        content: { content_type: message.contentType ?? null, parts: [message.text] },
        status: message.status ?? null,
        end_turn: message.endTurn ?? null,
        metadata: { model_slug: message.modelSlug ?? null, message_type: message.messageType ?? null },
      },
      parent: message.parentMessageId ?? null,
      children: message.children ?? [],
    } as JsonTreeValue;
  }
  return {
    chat_id: history.chatId,
    title: history.chatName,
    current_node: history.currentNode ?? null,
    captured_at: history.capturedAt,
    updated_at: history.updatedAt,
    mapping,
  } as JsonTreeValue;
}
