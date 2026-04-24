import type { ChatFileRecord, ChatHistoryMessageRecord, ChatHistoryRecord } from '../../shared/contracts';

export type ChatEditorTabState = {
  id: string;
  title: string;
  projectId: string;
  chatId: string;
  status: 'loading' | 'ready' | 'empty' | 'error';
  history: ChatHistoryRecord | null;
  message: string | null;
};

type ChatHistoryRenderItem =
  | {
      kind: 'message';
      message: ChatHistoryMessageRecord;
    }
  | {
      kind: 'reasoning';
      summaryMessage: ChatHistoryMessageRecord;
      hiddenMessages: ChatHistoryMessageRecord[];
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
  hiddenMessages: readonly ChatHistoryMessageRecord[],
  filesByMessageId: ReadonlyMap<string, ChatFileRecord[]>,
  helpers: ChatHistoryHelpers,
): HTMLElement {
  const reasoning = summaryMessage.reasoning;
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
  meta.textContent = `${String(hiddenMessages.length)} hidden ${hiddenMessages.length === 1 ? 'message' : 'messages'}`;
  summary.append(meta);

  details.append(summary);

  const body = document.createElement('div');
  body.className = 'chat-reasoning__body';

  if (hiddenMessages.length) {
    const messageChain = document.createElement('div');
    messageChain.className = 'chat-reasoning__messages';

    for (const message of hiddenMessages) {
      messageChain.append(createChatMessageElement(message, filesByMessageId.get(message.messageId ?? '') ?? [], helpers, { nested: true }));
    }

    body.append(messageChain);
  }

  if (!hiddenMessages.length && (reasoning?.steps.length ?? 0)) {
    for (const [index, step] of (reasoning?.steps ?? []).entries()) {
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
  }

  if (!hiddenMessages.length && !(reasoning?.steps.length ?? 0)) {
    const empty = document.createElement('div');
    empty.className = 'chat-reasoning__empty';
    empty.textContent = 'No captured assistant/tool messages were found for this reasoning block.';
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
  const items: ChatHistoryRenderItem[] = [];
  let cursor = 0;

  while (cursor < messages.length) {
    const message = messages[cursor];
    if (message.role === 'user') {
      items.push({ kind: 'message', message });
      cursor += 1;
      continue;
    }

    let segmentEnd = cursor;
    while (segmentEnd < messages.length && messages[segmentEnd].role !== 'user') {
      segmentEnd += 1;
    }

    const segment = messages.slice(cursor, segmentEnd);
    const summaryMessage = segment.at(-1);
    if (!summaryMessage || summaryMessage.contentType !== 'reasoning_recap') {
      for (const entry of segment) {
        items.push({ kind: 'message', message: entry });
      }
      cursor = segmentEnd;
      continue;
    }

    const hiddenCandidates = segment.slice(0, -1);
    let finalAssistantIndex = -1;
    for (let index = hiddenCandidates.length - 1; index >= 0; index -= 1) {
      const candidate = hiddenCandidates[index];
      if (candidate.role === 'assistant' && candidate.contentType === 'text') {
        finalAssistantIndex = index;
        break;
      }
    }

    if (finalAssistantIndex === -1) {
      items.push({
        kind: 'reasoning',
        summaryMessage,
        hiddenMessages: [...hiddenCandidates],
      });
      cursor = segmentEnd;
      continue;
    }

    const collapsedMessages = hiddenCandidates.filter((_, index) => index !== finalAssistantIndex);
    items.push({
      kind: 'reasoning',
      summaryMessage,
      hiddenMessages: collapsedMessages,
    });

    items.push({
      kind: 'message',
      message: hiddenCandidates[finalAssistantIndex],
    });

    cursor = segmentEnd;
  }

  return items;
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

  const header = document.createElement('div');
  header.className = 'chat-history-header';

  const headerTop = document.createElement('div');
  headerTop.className = 'chat-history-header__top';


  const title = document.createElement('h2');
  title.className = 'chat-history-header__title';
  title.textContent = history.chatName ?? tab.title;
  headerTop.append(title);
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

  const messages = document.createElement('div');
  messages.className = 'chat-history-messages';
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
    shell.append(messages);
    return shell;
  }

  for (const item of buildChatHistoryRenderItems(history.messages)) {
    if (item.kind === 'reasoning') {
      messages.append(createReasoningBlock(item.summaryMessage, item.hiddenMessages, filesByMessageId, helpers));
      continue;
    }

    messages.append(createChatMessageElement(item.message, filesByMessageId.get(item.message.messageId ?? '') ?? [], helpers));
  }

  shell.append(messages);

  return shell;
}
