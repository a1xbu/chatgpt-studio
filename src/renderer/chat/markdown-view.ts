import type { ChatFileRecord, ChatHistoryMessageRecord, ChatHistoryRecord } from '../../shared/contracts';
import type { ChatHistoryHelpers } from './history';
import type { DesktopPocApi } from '../desktop-api';

type ChatHistoryTurn = {
  index: number;
  userMessages: ChatHistoryMessageRecord[];
  thinkingTrail: ChatHistoryMessageRecord[];
  finalAssistantMessages: ChatHistoryMessageRecord[];
  recap: ChatHistoryMessageRecord | null;
  files: ChatFileRecord[];
};

function isFinalAssistantTextMessage(message: ChatHistoryMessageRecord): boolean {
  if (message.role !== 'assistant') {
    return false;
  }
  if (message.isHidden) {
    return false;
  }
  const contentType = message.contentType ?? null;
  if (contentType && contentType !== 'text' && contentType !== 'multimodal_text') {
    return false;
  }
  return Boolean(message.text);
}

function shouldSkipLocalChatDisplayMessage(message: ChatHistoryMessageRecord): boolean {
  const contentType = message.contentType ?? null;
  if (contentType === 'model_editable_context' || contentType === 'user_editable_context') {
    return true;
  }

  if (message.role === 'system' && !message.text && !message.parts?.length) {
    return true;
  }

  return false;
}

function isThinkingTrailMessage(message: ChatHistoryMessageRecord): boolean {
  if (message.role === 'user') {
    return false;
  }
  if (isFinalAssistantTextMessage(message)) {
    return false;
  }
  if (shouldSkipLocalChatDisplayMessage(message)) {
    return false;
  }

  const contentType = message.contentType ?? null;
  if (
    message.role === 'tool' ||
    contentType === 'reasoning_recap' ||
    contentType === 'thoughts' ||
    contentType === 'code' ||
    contentType === 'execution_output' ||
    contentType === 'tether_browsing_display'
  ) {
    return true;
  }

  return Boolean(message.text || message.parts?.length);
}

function buildHistoryTurns(
  history: ChatHistoryRecord,
  filesByMessageId: Map<string, ChatFileRecord[]>,
): ChatHistoryTurn[] {
  const turns: ChatHistoryTurn[] = [];

  const beginTurn = (): ChatHistoryTurn => ({
    index: turns.length,
    userMessages: [],
    thinkingTrail: [],
    finalAssistantMessages: [],
    recap: null,
    files: [],
  });

  let current: ChatHistoryTurn | null = null;
  for (const message of history.messages) {
    if (shouldSkipLocalChatDisplayMessage(message)) {
      continue;
    }

    if (message.role === 'user') {
      if (message.isHidden && !message.text && !message.parts?.length) {
        continue;
      }

      if (current) {
        turns.push(current);
      }
      current = beginTurn();
      current.userMessages.push(message);
      continue;
    }

    if (!current) {
      current = beginTurn();
    }

    if (isFinalAssistantTextMessage(message)) {
      current.finalAssistantMessages.push(message);
      continue;
    }

    if (message.contentType === 'reasoning_recap') {
      current.recap = message;
    }

    if (isThinkingTrailMessage(message)) {
      current.thinkingTrail.push(message);
    }
  }

  if (current) {
    turns.push(current);
  }

  for (const turn of turns) {
    const seenFileKeys = new Set<string>();
    const messagesInTurn: ChatHistoryMessageRecord[] = [
      ...turn.userMessages,
      ...turn.thinkingTrail,
      ...turn.finalAssistantMessages,
    ];
    for (const message of messagesInTurn) {
      if (!message.messageId) {
        continue;
      }
      const files = filesByMessageId.get(message.messageId);
      if (!files) {
        continue;
      }
      for (const file of files) {
        const key = `${file.messageId}::${file.sandboxPath}`;
        if (seenFileKeys.has(key)) {
          continue;
        }
        seenFileKeys.add(key);
        turn.files.push(file);
      }
    }
  }

  return turns;
}

function formatToolName(message: ChatHistoryMessageRecord): string {
  return message.authorName?.trim() || 'tool';
}

function describeContentType(message: ChatHistoryMessageRecord): string {
  const toolName = formatToolName(message);
  switch (message.contentType) {
    case 'code':
      return message.language && message.language !== 'unknown'
        ? `Assistant · code · ${message.language}`
        : 'Assistant · code';
    case 'execution_output':
      return message.role === 'tool' ? `Tool · ${toolName} · output` : 'Tool · output';
    case 'tether_browsing_display':
      return message.role === 'tool' ? `Tool · ${toolName} · browsing` : 'Tool · browsing';
    case 'multimodal_text':
      return message.role === 'tool' ? `Tool · ${toolName}` : 'Multimodal';
    case 'reasoning_recap':
      return 'Reasoning recap';
    case 'thoughts':
      return 'Thinking';
    default:
      return message.role === 'tool'
        ? `Tool · ${toolName}`
        : message.contentType ?? message.role;
  }
}

function formatThoughtLabel(turn: ChatHistoryTurn): string {
  if (turn.recap) {
    const recapText = turn.recap.text || turn.recap.reasoning?.recap;
    if (recapText) {
      return recapText;
    }

    const duration = turn.recap.reasoning?.finishedDurationSec ?? null;
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      return `Thought for ${String(Math.round(duration))}s`;
    }

    return 'Thought';
  }

  if (turn.thinkingTrail.length) {
    return 'Thinking…';
  }

  return 'Thought';
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
    localPath.textContent = file.downloadPath ?? ' ';
    body.append(localPath);

    const size = document.createElement('div');
    size.className = 'chat-file__meta-line';
    size.textContent = helpers.formatFileSize(file.sizeBytes ?? null) || ' ';
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
): HTMLElement {
  const article = document.createElement('article');
  article.className = `chat-message chat-message--${message.role}`;

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

function createTrailEntryElement(
  message: ChatHistoryMessageRecord,
  helpers: ChatHistoryHelpers,
): { entry: HTMLElement; reasoningBody: HTMLElement | null } {
  const entry = document.createElement('section');
  entry.className = `chat-thought-trail__entry chat-thought-trail__entry--${message.contentType ?? message.role}`;

  const meta = document.createElement('div');
  meta.className = 'chat-thought-trail__meta';
  meta.textContent = describeContentType(message);
  entry.append(meta);

  const body = document.createElement('div');
  body.className = 'chat-thought-trail__body';

  let reasoningBody: HTMLElement | null = null;
  if (message.contentType === 'reasoning_recap' && message.reasoning) {
    body.classList.add('chat-thought-trail__body--reasoning-steps');
    renderReasoningStepsLazy(body, message, helpers);
    reasoningBody = body;
  } else {
    const rendered = helpers.renderMessageMarkdown(message);
    if (rendered) {
      body.innerHTML = rendered;
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'chat-thought-trail__placeholder';
      placeholder.textContent = message.contentType === 'thoughts'
        ? 'Thinking'
        : message.role === 'tool'
          ? 'No textual tool output captured.'
          : 'No visible text captured.';
      body.append(placeholder);
    }
  }

  entry.append(body);
  return { entry, reasoningBody };
}

function renderReasoningStepsContent(
  container: HTMLElement,
  steps: readonly { summary: string | null; content: string; chunks: string[] }[],
  helpers: ChatHistoryHelpers,
): void {
  container.innerHTML = '';
  if (!steps.length) {
    const empty = document.createElement('div');
    empty.className = 'chat-thought-trail__empty';
    empty.textContent = 'No captured reasoning steps were found for this recap.';
    container.append(empty);
    return;
  }

  for (const [index, step] of steps.entries()) {
    const stepElement = document.createElement('section');
    stepElement.className = 'chat-thought-trail__step';

    const stepHeader = document.createElement('div');
    stepHeader.className = 'chat-thought-trail__step-header';
    stepHeader.textContent = step.summary ?? `Thought ${String(index + 1)}`;
    stepElement.append(stepHeader);

    const stepContent = document.createElement('div');
    stepContent.className = 'chat-thought-trail__step-content';
    stepContent.innerHTML = helpers.renderMarkdown(step.content);
    stepElement.append(stepContent);

    container.append(stepElement);
  }
}

function renderReasoningStepsLazy(
  container: HTMLElement,
  message: ChatHistoryMessageRecord,
  helpers: ChatHistoryHelpers,
): void {
  const reasoning = message.reasoning;
  if (!reasoning) {
    container.textContent = '';
    return;
  }

  if (reasoning.stepsLoaded || reasoning.steps.length) {
    renderReasoningStepsContent(container, reasoning.steps, helpers);
    return;
  }

  const placeholder = document.createElement('div');
  placeholder.className = 'chat-thought-trail__placeholder';
  placeholder.textContent = 'Thoughts will load when you expand this turn.';
  container.append(placeholder);
}

async function ensureReasoningStepsLoaded(
  message: ChatHistoryMessageRecord,
  helpers: ChatHistoryHelpers,
): Promise<void> {
  const reasoning = message.reasoning;
  if (!reasoning || reasoning.stepsLoaded || reasoning.steps.length) {
    return;
  }
  if (!message.messageId || !helpers.loadMessageThoughts) {
    reasoning.stepsLoaded = true;
    return;
  }

  try {
    const steps = await helpers.loadMessageThoughts(message.messageId);
    reasoning.steps = steps;
  } catch {
    reasoning.steps = [];
  } finally {
    reasoning.stepsLoaded = true;
  }
}

function createThoughtBlock(
  turn: ChatHistoryTurn,
  helpers: ChatHistoryHelpers,
): HTMLElement {
  const details = document.createElement('details');
  details.className = 'chat-thought-block';

  const summary = document.createElement('summary');
  summary.className = 'chat-thought-block__summary';

  const label = document.createElement('span');
  label.className = 'chat-thought-block__label';
  label.textContent = formatThoughtLabel(turn);
  summary.append(label);

  if (turn.thinkingTrail.length) {
    const meta = document.createElement('span');
    meta.className = 'chat-thought-block__meta';
    const stepCount = turn.thinkingTrail.length;
    meta.textContent = `${String(stepCount)} ${stepCount === 1 ? 'step' : 'steps'}`;
    summary.append(meta);
  }

  details.append(summary);

  const body = document.createElement('div');
  body.className = 'chat-thought-block__body';
  details.append(body);

  let rendered = false;
  let recapReasoningContainer: HTMLElement | null = null;
  const renderTrail = (): void => {
    if (rendered) {
      return;
    }
    rendered = true;
    body.innerHTML = '';
    for (const message of turn.thinkingTrail) {
      const { entry, reasoningBody } = createTrailEntryElement(message, helpers);
      if (reasoningBody && message.contentType === 'reasoning_recap') {
        recapReasoningContainer = reasoningBody;
      }
      body.append(entry);
    }
  };

  details.addEventListener('toggle', () => {
    if (!details.open) {
      return;
    }
    renderTrail();

    const recap = turn.recap;
    if (recap && recap.reasoning && !recap.reasoning.stepsLoaded) {
      void ensureReasoningStepsLoaded(recap, helpers).then(() => {
        if (recapReasoningContainer && recap.reasoning) {
          renderReasoningStepsContent(recapReasoningContainer, recap.reasoning.steps, helpers);
        }
      });
    }

    requestAnimationFrame(() => {
      summary.scrollIntoView({ block: 'nearest' });
    });
  });

  return details;
}

function createTurnElement(
  turn: ChatHistoryTurn,
  helpers: ChatHistoryHelpers,
  filesByMessageId: Map<string, ChatFileRecord[]>,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-turn';

  for (const userMessage of turn.userMessages) {
    const messageFiles = userMessage.messageId ? filesByMessageId.get(userMessage.messageId) ?? [] : [];
    wrapper.append(createChatMessageElement(userMessage, messageFiles, helpers));
  }

  if (turn.thinkingTrail.length || turn.recap) {
    wrapper.append(createThoughtBlock(turn, helpers));
  }

  for (const assistantMessage of turn.finalAssistantMessages) {
    const messageFiles = assistantMessage.messageId ? filesByMessageId.get(assistantMessage.messageId) ?? [] : [];
    wrapper.append(createChatMessageElement(assistantMessage, messageFiles, helpers));
  }

  const handledMessageIds = new Set<string>();
  for (const message of [...turn.userMessages, ...turn.thinkingTrail, ...turn.finalAssistantMessages]) {
    if (message.messageId) {
      handledMessageIds.add(message.messageId);
    }
  }

  const unboundFiles = turn.files.filter((file) => !handledMessageIds.has(file.messageId));
  if (unboundFiles.length) {
    wrapper.append(createChatFileList(unboundFiles, helpers));
  }

  return wrapper;
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

  const turns = buildHistoryTurns(history, filesByMessageId);
  for (const turn of turns) {
    messages.append(createTurnElement(turn, helpers, filesByMessageId));
  }

  return messages;
}

export type { DesktopPocApi };
