import type { ChatFileRecord, ChatHistoryMessageRecord, ChatHistoryRecord } from '../../shared/contracts';
import type { ChatHistoryHelpers } from './history';
import type { DesktopPocApi } from '../desktop-api';

const ROOT_PARENT_KEY = '__root__';

type BranchNav = {
  parentKey: string;
  total: number;
  activeIndex: number;
  siblingNodeIds: string[];
};

type DisplayItem = {
  node: ChatHistoryMessageRecord;
  branchNav: BranchNav | null;
};

type ChatHistoryTurn = {
  index: number;
  userMessage: ChatHistoryMessageRecord | null;
  userBranchNav: BranchNav | null;
  thinkingTrail: Array<{ node: ChatHistoryMessageRecord; branchNav: BranchNav | null }>;
  finalAssistantMessages: Array<{ node: ChatHistoryMessageRecord; branchNav: BranchNav | null }>;
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

function shouldSkipDisplay(message: ChatHistoryMessageRecord): boolean {
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
  if (shouldSkipDisplay(message)) {
    return false;
  }
  const contentType = message.contentType ?? null;
  if (
    message.role === 'tool'
    || contentType === 'reasoning_recap'
    || contentType === 'thoughts'
    || contentType === 'code'
    || contentType === 'execution_output'
    || contentType === 'tether_browsing_display'
  ) {
    return true;
  }
  return Boolean(message.text || message.parts?.length);
}

function buildDisplayItems(
  history: ChatHistoryRecord,
  overrides: Map<string, string>,
): DisplayItem[] {
  const messages = history.messages;
  const byNodeId = new Map<string, ChatHistoryMessageRecord>();
  const byMessageId = new Map<string, ChatHistoryMessageRecord>();
  for (const message of messages) {
    if (message.nodeId) {
      byNodeId.set(message.nodeId, message);
    }
    if (message.messageId) {
      byMessageId.set(message.messageId, message);
    }
  }

  // Legacy / partial fallback: no nodeIds available → linearise the messages
  // array as-is. Branch navigation becomes a no-op.
  if (!byNodeId.size) {
    return messages.map((node) => ({ node, branchNav: null }));
  }

  const activeChildByParent = new Map(overrides);
  if (history.currentNode) {
    let cursor: ChatHistoryMessageRecord | undefined = byNodeId.get(history.currentNode);
    while (cursor) {
      const parentKey = cursor.parentMessageId ?? ROOT_PARENT_KEY;
      if (cursor.nodeId && !activeChildByParent.has(parentKey)) {
        activeChildByParent.set(parentKey, cursor.nodeId);
      }
      const parentMessageId = cursor.parentMessageId;
      cursor = parentMessageId ? byMessageId.get(parentMessageId) : undefined;
    }
  }

  const rootGroups = new Map<string, ChatHistoryMessageRecord[]>();
  for (const message of messages) {
    const parentMessageId = message.parentMessageId ?? null;
    const isRoot = !parentMessageId || !byMessageId.has(parentMessageId);
    if (!isRoot) {
      continue;
    }
    const list = rootGroups.get(ROOT_PARENT_KEY) ?? [];
    list.push(message);
    rootGroups.set(ROOT_PARENT_KEY, list);
  }

  const items: DisplayItem[] = [];
  const visited = new Set<string>();

  function pickActiveChild(parentKey: string, candidateNodeIds: string[]): {
    activeNodeId: string | null;
    activeIndex: number;
  } {
    const filtered = candidateNodeIds.filter((nid) => byNodeId.has(nid));
    if (!filtered.length) {
      return { activeNodeId: null, activeIndex: 0 };
    }
    const overrideNodeId = activeChildByParent.get(parentKey);
    const activeNodeId = overrideNodeId && filtered.includes(overrideNodeId)
      ? overrideNodeId
      : filtered[filtered.length - 1];
    return { activeNodeId, activeIndex: filtered.indexOf(activeNodeId) };
  }

  function walk(node: ChatHistoryMessageRecord | null, branchNav: BranchNav | null): void {
    let nextBranchNav = branchNav;
    while (node) {
      const visitedKey = node.nodeId ?? node.messageId ?? '';
      if (visitedKey && visited.has(visitedKey)) {
        break;
      }
      if (visitedKey) {
        visited.add(visitedKey);
      }
      items.push({ node, branchNav: nextBranchNav });
      nextBranchNav = null;

      const childNodeIds = (node.children ?? []).filter((nid) => byNodeId.has(nid));
      if (!childNodeIds.length) {
        break;
      }
      const parentKey = node.messageId ?? `nodeid:${node.nodeId ?? ''}`;
      const { activeNodeId, activeIndex } = pickActiveChild(parentKey, childNodeIds);
      if (!activeNodeId) {
        break;
      }
      const childNode = byNodeId.get(activeNodeId);
      if (!childNode) {
        break;
      }
      nextBranchNav = childNodeIds.length > 1
        ? { parentKey, total: childNodeIds.length, activeIndex, siblingNodeIds: childNodeIds }
        : null;
      node = childNode;
    }
  }

  const rootGroup = rootGroups.get(ROOT_PARENT_KEY) ?? [];
  const rootNodeIds = rootGroup.map((message) => message.nodeId).filter((id): id is string => Boolean(id));
  if (rootNodeIds.length) {
    const { activeNodeId, activeIndex } = pickActiveChild(ROOT_PARENT_KEY, rootNodeIds);
    if (activeNodeId) {
      const rootNode = byNodeId.get(activeNodeId);
      const rootNav: BranchNav | null = rootNodeIds.length > 1
        ? { parentKey: ROOT_PARENT_KEY, total: rootNodeIds.length, activeIndex, siblingNodeIds: rootNodeIds }
        : null;
      walk(rootNode ?? null, rootNav);
    }
  }

  // Append truly orphan messages we never reached via the tree walk — i.e.
  // live-stream deltas that lack node_id / parent links and aren't part of
  // any other in-tree branch. Alternative branches that *are* reachable in
  // the snapshot stay hidden behind the branch switcher.
  for (const message of messages) {
    const visitedKey = message.nodeId ?? message.messageId ?? '';
    if (!visitedKey || visited.has(visitedKey)) {
      continue;
    }
    const parentMessageId = message.parentMessageId ?? null;
    const isOrphan = !parentMessageId || !byMessageId.has(parentMessageId);
    if (!isOrphan) {
      continue;
    }
    visited.add(visitedKey);
    items.push({ node: message, branchNav: null });
  }

  return items;
}

function buildHistoryTurns(
  items: readonly DisplayItem[],
  filesByMessageId: Map<string, ChatFileRecord[]>,
): ChatHistoryTurn[] {
  const turns: ChatHistoryTurn[] = [];
  let current: ChatHistoryTurn | null = null;

  const beginTurn = (): ChatHistoryTurn => ({
    index: turns.length,
    userMessage: null,
    userBranchNav: null,
    thinkingTrail: [],
    finalAssistantMessages: [],
    recap: null,
    files: [],
  });

  for (const item of items) {
    const message = item.node;
    if (shouldSkipDisplay(message)) {
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
      current.userMessage = message;
      current.userBranchNav = item.branchNav;
      continue;
    }

    if (!current) {
      current = beginTurn();
    }

    if (isFinalAssistantTextMessage(message)) {
      current.finalAssistantMessages.push({ node: message, branchNav: item.branchNav });
      continue;
    }

    if (message.contentType === 'reasoning_recap') {
      current.recap = message;
    }

    if (isThinkingTrailMessage(message)) {
      current.thinkingTrail.push({ node: message, branchNav: item.branchNav });
    }
  }

  if (current) {
    turns.push(current);
  }

  for (const turn of turns) {
    const seenFileKeys = new Set<string>();
    const messageIds: string[] = [];
    if (turn.userMessage?.messageId) {
      messageIds.push(turn.userMessage.messageId);
    }
    for (const entry of turn.thinkingTrail) {
      if (entry.node.messageId) {
        messageIds.push(entry.node.messageId);
      }
    }
    for (const entry of turn.finalAssistantMessages) {
      if (entry.node.messageId) {
        messageIds.push(entry.node.messageId);
      }
    }
    for (const messageId of messageIds) {
      const files = filesByMessageId.get(messageId);
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

function createBranchSwitcher(
  branchNav: BranchNav,
  onSwitch: (parentKey: string, nextNodeId: string) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-branch-switcher';

  const total = branchNav.total;
  const activeIndex = Math.max(0, Math.min(total - 1, branchNav.activeIndex));

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'chat-branch-switcher__btn';
  prev.textContent = '◄';
  prev.title = 'Previous version';
  prev.disabled = total <= 1;
  prev.addEventListener('click', () => {
    const nextIdx = (activeIndex - 1 + total) % total;
    onSwitch(branchNav.parentKey, branchNav.siblingNodeIds[nextIdx]);
  });

  const label = document.createElement('span');
  label.className = 'chat-branch-switcher__label';
  label.textContent = `${String(activeIndex + 1)} / ${String(total)}`;

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'chat-branch-switcher__btn';
  next.textContent = '►';
  next.title = 'Next version';
  next.disabled = total <= 1;
  next.addEventListener('click', () => {
    const nextIdx = (activeIndex + 1) % total;
    onSwitch(branchNav.parentKey, branchNav.siblingNodeIds[nextIdx]);
  });

  wrapper.append(prev, label, next);
  return wrapper;
}

function createChatMessageElement(
  message: ChatHistoryMessageRecord,
  files: readonly ChatFileRecord[],
  helpers: ChatHistoryHelpers,
  branchNav: BranchNav | null,
  onSwitch: (parentKey: string, nextNodeId: string) => void,
): HTMLElement {
  const article = document.createElement('article');
  article.className = `chat-message chat-message--${message.role}`;

  const metaRow = document.createElement('div');
  metaRow.className = 'chat-message__meta';

  const role = document.createElement('span');
  role.className = 'chat-message__role';
  role.textContent = helpers.formatChatMessageRole(message.role);
  metaRow.append(role);

  if (branchNav) {
    metaRow.append(createBranchSwitcher(branchNav, onSwitch));
  }

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
  branchNav: BranchNav | null,
  onSwitch: (parentKey: string, nextNodeId: string) => void,
): { entry: HTMLElement; reasoningBody: HTMLElement | null } {
  const entry = document.createElement('section');
  entry.className = `chat-thought-trail__entry chat-thought-trail__entry--${message.contentType ?? message.role}`;

  const meta = document.createElement('div');
  meta.className = 'chat-thought-trail__meta';
  meta.textContent = describeContentType(message);
  if (branchNav) {
    meta.append(createBranchSwitcher(branchNav, onSwitch));
  }
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
  onSwitch: (parentKey: string, nextNodeId: string) => void,
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
    for (const entry of turn.thinkingTrail) {
      const { entry: el, reasoningBody } = createTrailEntryElement(entry.node, helpers, entry.branchNav, onSwitch);
      if (reasoningBody && entry.node.contentType === 'reasoning_recap') {
        recapReasoningContainer = reasoningBody;
      }
      body.append(el);
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
  onSwitch: (parentKey: string, nextNodeId: string) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-turn';

  if (turn.userMessage) {
    const messageFiles = turn.userMessage.messageId
      ? filesByMessageId.get(turn.userMessage.messageId) ?? []
      : [];
    wrapper.append(createChatMessageElement(turn.userMessage, messageFiles, helpers, turn.userBranchNav, onSwitch));
  }

  if (turn.thinkingTrail.length || turn.recap) {
    wrapper.append(createThoughtBlock(turn, helpers, onSwitch));
  }

  for (const entry of turn.finalAssistantMessages) {
    const messageFiles = entry.node.messageId
      ? filesByMessageId.get(entry.node.messageId) ?? []
      : [];
    wrapper.append(createChatMessageElement(entry.node, messageFiles, helpers, entry.branchNav, onSwitch));
  }

  const handledMessageIds = new Set<string>();
  if (turn.userMessage?.messageId) {
    handledMessageIds.add(turn.userMessage.messageId);
  }
  for (const entry of turn.thinkingTrail) {
    if (entry.node.messageId) {
      handledMessageIds.add(entry.node.messageId);
    }
  }
  for (const entry of turn.finalAssistantMessages) {
    if (entry.node.messageId) {
      handledMessageIds.add(entry.node.messageId);
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
  branchOverridesRef?: { value: Map<string, string> },
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'chat-history-messages chat-history-panel';

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
    panel.append(createEmptyState('No text messages were extracted from this conversation snapshot yet.'));
    return panel;
  }

  const overrides = branchOverridesRef ?? { value: new Map<string, string>() };

  const render = (): void => {
    panel.innerHTML = '';
    const items = buildDisplayItems(history, overrides.value);
    const turns = buildHistoryTurns(items, filesByMessageId);
    if (!turns.length) {
      panel.append(createEmptyState('No text messages to display in the active branch.'));
      return;
    }
    const onSwitch = (parentKey: string, nextNodeId: string): void => {
      overrides.value.set(parentKey, nextNodeId);
      render();
    };
    for (const turn of turns) {
      panel.append(createTurnElement(turn, helpers, filesByMessageId, onSwitch));
    }
  };

  render();
  return panel;
}

export type { DesktopPocApi };
