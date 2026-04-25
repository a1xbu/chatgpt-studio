import type { ChatFileRecord, ChatHistoryMessageRecord, ChatHistoryRecord } from '../../shared/contracts';

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
};

type ChatHistoryRenderItem =
  | {
      kind: 'message';
      message: ChatHistoryMessageRecord;
    }
  | {
      kind: 'reasoning';
      summaryMessage: ChatHistoryMessageRecord;
    };

export type ChatHistoryHelpers = {
  formatTimestamp: (value: string | null | undefined) => string;
  formatFileSize: (sizeBytes: number | null | undefined) => string;
  formatChatMessageRole: (role: ChatHistoryMessageRecord['role']) => string;
  formatChatMessageTimestamp: (message: ChatHistoryMessageRecord) => string;
  renderMessageMarkdown: (message: ChatHistoryMessageRecord) => string;
  renderMarkdown: (markdown: string) => string;
  renderGenericFileIcon: () => string;
};

export function createChatHistoryEmptyState(message: string): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'chat-history-empty';
  element.textContent = message;
  return element;
}

export function countReasoningBlocks(history: ChatHistoryRecord | null): number {
  return history?.messages.filter((message) => message.contentType === 'reasoning_recap').length ?? 0;
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
    { mode: 'raw-json', label: 'Raw JSON' },
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
  rawJsonPanel: HTMLElement,
  mode: ChatHistoryViewMode,
): void {
  tab.viewMode = mode;
  const showRawJson = mode === 'raw-json';
  shell.classList.toggle('chat-history-shell--raw-json', showRawJson);
  markdownPanel.hidden = showRawJson;
  rawJsonPanel.hidden = !showRawJson;
}

function createRawJsonPanel(history: ChatHistoryRecord): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'chat-history-raw-json';

  const pre = document.createElement('pre');
  pre.className = 'chat-history-raw-json__content';
  pre.textContent = formatRawChatHistoryJson(history);
  panel.append(pre);
  return panel;
}

function createChatFileList(files: readonly ChatFileRecord[], helpers: ChatHistoryHelpers): HTMLElement {
  const section = document.createElement('section');
  section.className = 'chat-message__files';

  const title = document.createElement('div');
  title.className = 'chat-message__files-title';
  title.textContent = `Files (${String(files.length)})`;
  section.append(title);

  const list = document.createElement('div');
  list.className = 'chat-file-list';

  for (const file of files) {
    const item = document.createElement('div');
    item.className = `chat-file ${file.downloadPath ? 'chat-file--downloaded' : 'chat-file--missing'}`;

    const header = document.createElement('div');
    header.className = 'chat-file__header';

    const icon = document.createElement('div');
    icon.className = 'chat-file__icon';
    icon.innerHTML = helpers.renderGenericFileIcon();
    header.append(icon);

    const body = document.createElement('div');
    body.className = 'chat-file__body';

    const pathLabel = document.createElement('div');
    pathLabel.className = 'chat-file__path';
    pathLabel.title = file.sandboxPath;
    pathLabel.textContent = file.sandboxPath;
    body.append(pathLabel);

    const localPath = document.createElement('div');
    localPath.className = 'chat-file__meta-line';
    localPath.title = file.downloadPath ?? '';
    localPath.textContent = file.downloadPath ?? ' ';
    body.append(localPath);

    const size = document.createElement('div');
    size.className = 'chat-file__meta-line';
    size.textContent = helpers.formatFileSize(file.sizeBytes ?? null) || ' ';
    body.append(size);

    header.append(body);

    if (file.downloadPath) {
      const showInFolderButton = document.createElement('button');
      showInFolderButton.type = 'button';
      showInFolderButton.className = 'chat-file__show-in-folder';
      showInFolderButton.dataset.action = 'show-file-in-folder';
      showInFolderButton.dataset.filePath = file.downloadPath;
      showInFolderButton.title = 'Show in folder';
      showInFolderButton.innerHTML = '↗';
      header.append(showInFolderButton);
    }

    item.append(header);
    list.append(item);
  }

  section.append(list);
  return section;
}

function createChatMessageElement(
  message: ChatHistoryMessageRecord,
  files: readonly ChatFileRecord[],
  helpers: ChatHistoryHelpers,
  options: { nested?: boolean } = {},
): HTMLElement {
  const article = document.createElement('article');
  article.className = `chat-message chat-message--${message.role}`;
  if (options.nested) {
    article.classList.add('chat-message--nested');
  }

  const metaRow = document.createElement('div');
  metaRow.className = 'chat-message__meta';

  const role = document.createElement('span');
  role.className = 'chat-message__role';
  role.textContent = helpers.formatChatMessageRole(message.role);
  metaRow.append(role);

  const time = document.createElement('span');
  time.className = 'chat-message__time';
  time.textContent = helpers.formatChatMessageTimestamp(message);
  metaRow.append(time);

  const text = document.createElement('div');
  text.className = 'chat-message__markdown';
  text.innerHTML = helpers.renderMessageMarkdown(message);

  article.append(metaRow, text);
  if (files.length) {
    article.append(createChatFileList(files, helpers));
  }
  return article;
}

function createReasoningBlock(
  summaryMessage: ChatHistoryMessageRecord,
  helpers: ChatHistoryHelpers,
): HTMLElement {
  const reasoning = summaryMessage.reasoning;
  const steps = reasoning?.steps ?? [];
  const details = document.createElement('details');
  details.className = 'chat-reasoning';

  const summary = document.createElement('summary');
  summary.className = 'chat-reasoning__summary';

  const label = document.createElement('span');
  label.className = 'chat-reasoning__label';
  label.textContent = summaryMessage.text || reasoning?.recap || 'Thought';
  summary.append(label);

  const meta = document.createElement('span');
  meta.className = 'chat-reasoning__meta';
  meta.textContent = steps.length ? `${String(steps.length)} ${steps.length === 1 ? 'step' : 'steps'}` : 'No captured steps';
  summary.append(meta);

  details.append(summary);

  const body = document.createElement('div');
  body.className = 'chat-reasoning__body';

  if (steps.length) {
    for (const [index, step] of steps.entries()) {
      const stepElement = document.createElement('section');
      stepElement.className = 'chat-reasoning__step';

      const stepHeader = document.createElement('div');
      stepHeader.className = 'chat-reasoning__step-header';
      stepHeader.textContent = step.summary ?? `Thought ${String(index + 1)}`;
      stepElement.append(stepHeader);

      const stepContent = document.createElement('div');
      stepContent.className = 'chat-reasoning__step-content';
      stepContent.innerHTML = helpers.renderMarkdown(step.content);
      stepElement.append(stepContent);

      body.append(stepElement);
    }
  } else {
    const empty = document.createElement('div');
    empty.className = 'chat-reasoning__empty';
    empty.textContent = 'No captured reasoning steps were found for this reasoning recap.';
    body.append(empty);
  }

  details.append(body);
  details.addEventListener('toggle', () => {
    if (!details.open) {
      return;
    }

    requestAnimationFrame(() => {
      summary.scrollIntoView({ block: 'nearest' });
    });
  });
  return details;
}

function buildChatHistoryRenderItems(messages: readonly ChatHistoryMessageRecord[]): ChatHistoryRenderItem[] {
  return messages.map<ChatHistoryRenderItem>((message) => {
    if (message.contentType === 'reasoning_recap') {
      return { kind: 'reasoning', summaryMessage: message };
    }

    return { kind: 'message', message };
  });
}

export function createChatHistoryTabContent(
  tab: ChatEditorTabState,
  chatUrl: string,
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
  const messages = document.createElement('div');
  messages.className = 'chat-history-messages';
  const rawJsonPanel = createRawJsonPanel(history);

  const header = document.createElement('div');
  header.className = 'chat-history-header';

  const headerTop = document.createElement('div');
  headerTop.className = 'chat-history-header__top';

  const title = document.createElement('h2');
  title.className = 'chat-history-header__title';
  title.textContent = history.chatName ?? tab.title;
  headerTop.append(title);

  const viewToggle = createChatHistoryViewToggle(initialViewMode, (mode) => {
    setChatHistoryViewMode(tab, shell, messages, rawJsonPanel, mode);
  });
  headerTop.append(viewToggle);
  header.append(headerTop);

  const meta = document.createElement('div');
  meta.className = 'chat-history-header__meta';
  for (const entry of metaParts) {
    const item = document.createElement('span');
    item.textContent = entry;
    meta.append(item);
  }
  header.append(meta);
  shell.append(header);

  const filesByMessageId = new Map<string, ChatFileRecord[]>();

  for (const file of history.files ?? []) {
    if (!file.messageId) {
      continue;
    }

    const existing = filesByMessageId.get(file.messageId) ?? [];
    existing.push(file);
    filesByMessageId.set(file.messageId, existing);
  }

  if (!history.messages.length) {
    messages.append(createChatHistoryEmptyState('No text messages were extracted from this conversation snapshot yet.'));
  } else {
    for (const item of buildChatHistoryRenderItems(history.messages)) {
      if (item.kind === 'reasoning') {
        messages.append(createReasoningBlock(item.summaryMessage, helpers));
        continue;
      }

      messages.append(createChatMessageElement(item.message, filesByMessageId.get(item.message.messageId ?? '') ?? [], helpers));
    }
  }

  shell.append(messages, rawJsonPanel);
  setChatHistoryViewMode(tab, shell, messages, rawJsonPanel, initialViewMode);

  return shell;
}
