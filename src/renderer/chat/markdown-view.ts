import type { ChatFileRecord, ChatHistoryMessageRecord, ChatHistoryRecord } from '../../shared/contracts';
import type { ChatHistoryHelpers } from './history';

type ChatHistoryRenderItem =
  | {
      kind: 'message';
      message: ChatHistoryMessageRecord;
    }
  | {
      kind: 'reasoning';
      summaryMessage: ChatHistoryMessageRecord;
    };

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

export function createChatMarkdownView(
  history: ChatHistoryRecord,
  helpers: ChatHistoryHelpers,
  createEmptyState: (message: string) => HTMLElement,
): HTMLElement {
  const messages = document.createElement('div');
  messages.className = 'chat-history-messages chat-history-panel';

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
    messages.append(createEmptyState('No text messages were extracted from this conversation snapshot yet.'));
    return messages;
  }

  for (const item of buildChatHistoryRenderItems(history.messages)) {
    if (item.kind === 'reasoning') {
      messages.append(createReasoningBlock(item.summaryMessage, helpers));
      continue;
    }

    messages.append(createChatMessageElement(item.message, filesByMessageId.get(item.message.messageId ?? '') ?? [], helpers));
  }

  return messages;
}
