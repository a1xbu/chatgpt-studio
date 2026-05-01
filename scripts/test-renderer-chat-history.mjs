import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createChatHistoryTabContent } = require(path.join(rootDir, 'dist', 'renderer', 'chat', 'history.js'));
const { createJsonTreeView } = require(path.join(rootDir, 'dist', 'renderer', 'chat', 'json-tree.js'));

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set(String(owner.className ?? '').split(/\s+/).filter(Boolean));
  }

  sync() {
    this.owner.className = Array.from(this.values).join(' ');
  }

  add(...tokens) {
    for (const token of tokens) {
      if (token) this.values.add(token);
    }
    this.sync();
  }

  remove(...tokens) {
    for (const token of tokens) {
      this.values.delete(token);
    }
    this.sync();
  }

  toggle(token, force) {
    const shouldAdd = force === undefined ? !this.values.has(token) : Boolean(force);
    if (shouldAdd) {
      this.values.add(token);
    } else {
      this.values.delete(token);
    }
    this.sync();
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.eventListeners = new Map();
    this.className = '';
    this.classList = new FakeClassList(this);
    this.style = {};
    this._textContent = '';
    this._innerHTML = '';
    this.hidden = false;
    this.open = false;
    this.disabled = false;
  }

  get firstElementChild() {
    return this.children[0] ?? null;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value ?? '');
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value ?? '');
  }

  append(...children) {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  addEventListener(type, callback) {
    const listeners = this.eventListeners.get(type) ?? [];
    listeners.push(callback);
    this.eventListeners.set(type, listeners);
  }

  dispatchEvent(type) {
    const event = { stopPropagation() {} };
    for (const listener of this.eventListeners.get(type) ?? []) {
      listener(event);
    }
  }

  click() {
    this.dispatchEvent('click');
  }

  scrollIntoView() {}
}

globalThis.HTMLElement = FakeElement;
globalThis.HTMLButtonElement = FakeElement;
globalThis.document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },
};
globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 1;
};

let saveCall = null;
globalThis.window = {
  desktopPoc: {
    saveChatHistoryJson: async (defaultFileName, content) => {
      saveCall = { defaultFileName, content };
      return { saved: true, filePath: '/tmp/chat.json', errorMessage: null };
    },
  },
  setTimeout(callback) {
    callback();
    return 1;
  },
};

function classes(element) {
  return String(element.className ?? '').split(/\s+/).filter(Boolean);
}

function hasClass(element, className) {
  return classes(element).includes(className);
}

function descendants(element) {
  const output = [];
  const stack = [...element.children];
  while (stack.length) {
    const current = stack.shift();
    if (!current) continue;
    output.push(current);
    stack.unshift(...current.children);
  }
  return output;
}

function findByClass(element, className) {
  return descendants(element).find((candidate) => hasClass(candidate, className)) ?? null;
}

function findAllByClass(element, className) {
  return descendants(element).filter((candidate) => hasClass(candidate, className));
}

function createMessage(role, messageId, text, createdAt, contentType = 'text', extras = {}) {
  return {
    messageId,
    role,
    text,
    createdAt,
    updatedAt: null,
    contentType,
    reasoning: null,
    ...extras,
  };
}

const longText = 'x'.repeat(500);
const tab = {
  id: 'chat:project-1:chat-1',
  title: 'Chat 1',
  projectId: 'project-1',
  chatId: 'chat-1',
  status: 'ready',
  message: null,
  viewMode: 'markdown',
  history: {
    projectId: 'project-1',
    projectName: 'Project 1',
    chatId: 'chat-1',
    chatName: 'Chat 1',
    messageCount: 6,
    messages: [
      createMessage('user', 'u-1', 'Test the sandbox', '2026-04-25T05:39:48.000Z'),
      createMessage('assistant', 'thoughts-1', '', '2026-04-25T05:39:49.000Z', 'thoughts', { modelSlug: 'gpt-5-5-thinking' }),
      createMessage('assistant', 'code-1', "bash -lc echo 'hi'", '2026-04-25T05:39:49.573Z', 'code', { language: 'bash' }),
      createMessage('tool', 'exec-1', 'hi\n', '2026-04-25T05:39:50.000Z', 'execution_output', { authorName: 'container.exec' }),
      createMessage('assistant', 'recap-1', 'Thought for 19s', '2026-04-25T05:40:11.431Z', 'reasoning_recap', {
        reasoning: {
          recap: 'Thought for 19s',
          finishedDurationSec: 19,
          startedAt: null,
          endedAt: null,
          stepsLoaded: true,
          steps: [
            { summary: 'Planning MVP PoC for user request', content: 'planning step', chunks: ['planning step'] },
            { summary: 'Outlining MVP PoC and validation steps', content: 'validation step', chunks: ['validation step'] },
          ],
        },
      }),
      createMessage('assistant', 'final-1', longText, '2026-04-25T05:40:12.000Z', 'text', { modelSlug: 'gpt-5-5-thinking' }),
    ],
    files: [],
    searchText: '',
    updatedAt: '2026-04-25T05:40:11.431Z',
    capturedAt: '2026-04-25T05:40:11.431Z',
    isPartial: false,
  },
};

const shell = createChatHistoryTabContent(tab, 'https://chatgpt.com/c/chat-1', {
  formatTimestamp: (value) => value ?? '',
  formatFileSize: (sizeBytes) => (sizeBytes == null ? '' : String(sizeBytes)),
  formatChatMessageRole: (role) => role,
  formatChatMessageTimestamp: (message) => message.modelSlug ? String(message.createdAt ?? '') + ' · ' + message.modelSlug : message.createdAt ?? '',
  renderMessageMarkdown: (message) => message.text,
  renderMarkdown: (markdown) => markdown,
  renderGenericFileIcon: () => 'file',
});

const messagesElement = findByClass(shell, 'chat-history-messages');
assert.ok(messagesElement);
assert.equal(messagesElement.children.length, 1, 'one turn rendered');
assert.equal(messagesElement.hidden, false);

const turnElement = messagesElement.children[0];
assert.ok(hasClass(turnElement, 'chat-turn'));

const jsonTreePanel = findByClass(shell, 'chat-history-json-tree');
assert.ok(jsonTreePanel);
assert.equal(jsonTreePanel.hidden, true);
assert.ok(findByClass(jsonTreePanel, 'json-tree'));
assert.ok(!findByClass(shell, 'chat-history-raw-json__content'));

const viewToggle = findByClass(shell, 'chat-history-view-toggle');
assert.ok(viewToggle);
assert.equal(viewToggle.children.length, 2);
assert.equal(viewToggle.children[0].getAttribute('aria-pressed'), 'true');
assert.equal(viewToggle.children[1].getAttribute('aria-pressed'), 'false');

viewToggle.children[1].click();
assert.equal(tab.viewMode, 'raw-json');
assert.equal(messagesElement.hidden, true);
assert.equal(jsonTreePanel.hidden, false);
assert.ok(hasClass(shell, 'chat-history-shell--raw-json'));
assert.equal(viewToggle.children[0].getAttribute('aria-pressed'), 'false');
assert.equal(viewToggle.children[1].getAttribute('aria-pressed'), 'true');
const directTree = createJsonTreeView({ text: longText });
assert.ok(findAllByClass(directTree, 'json-tree__expand-string').length >= 1);

viewToggle.children[0].click();
assert.equal(tab.viewMode, 'markdown');
assert.equal(messagesElement.hidden, false);
assert.equal(jsonTreePanel.hidden, true);
assert.ok(!hasClass(shell, 'chat-history-shell--raw-json'));

const saveButton = findByClass(shell, 'chat-history-save-json');
assert.ok(saveButton);
saveButton.click();
await Promise.resolve();
assert.equal(saveCall.defaultFileName, 'Chat 1.json');
assert.match(saveCall.content, /\n  "messages": \[\n/);
assert.match(saveCall.content, /recap-1/);

const turnChildren = turnElement.children;
const userMessageElement = turnChildren.find((child) => hasClass(child, 'chat-message--user'));
const thoughtBlock = turnChildren.find((child) => hasClass(child, 'chat-thought-block'));
const finalAssistantElement = turnChildren.find((child) => hasClass(child, 'chat-message--assistant'));

assert.ok(userMessageElement, 'user message rendered');
assert.ok(thoughtBlock, 'thought block rendered between user and assistant');
assert.ok(finalAssistantElement, 'final assistant message rendered');

// Order: user → thought → assistant
assert.equal(turnChildren.indexOf(userMessageElement), 0, 'user message first');
assert.ok(turnChildren.indexOf(thoughtBlock) < turnChildren.indexOf(finalAssistantElement),
  'thought block precedes final assistant message');

assert.equal(findByClass(userMessageElement, 'chat-message__markdown')?.innerHTML, 'Test the sandbox');
assert.equal(findByClass(finalAssistantElement, 'chat-message__markdown')?.innerHTML, longText);
assert.equal(findByClass(finalAssistantElement, 'chat-message__time')?.textContent, '2026-04-25T05:40:12.000Z · gpt-5-5-thinking');

assert.equal(findByClass(thoughtBlock, 'chat-thought-block__label')?.textContent, 'Thought for 19s');
assert.equal(findByClass(thoughtBlock, 'chat-thought-block__meta')?.textContent, '4 steps');

// trail body is empty until expanded
assert.equal(findByClass(thoughtBlock, 'chat-thought-block__body')?.children.length ?? 0, 0,
  'trail entries are not rendered before expansion');

// expand and assert lazy rendering
thoughtBlock.open = true;
thoughtBlock.dispatchEvent('toggle');

const trailEntries = findAllByClass(thoughtBlock, 'chat-thought-trail__entry');
assert.equal(trailEntries.length, 4, 'four trail entries: thoughts, code, execution_output, reasoning_recap');
const trailMetas = trailEntries.map((entry) => findByClass(entry, 'chat-thought-trail__meta')?.textContent);
assert.deepEqual(trailMetas, ['Thinking', 'Assistant · code · bash', 'Tool · container.exec · output', 'Reasoning recap']);

await Promise.resolve();

const stepHeaders = findAllByClass(thoughtBlock, 'chat-thought-trail__step-header').map((el) => el.textContent);
assert.deepEqual(stepHeaders, [
  'Planning MVP PoC for user request',
  'Outlining MVP PoC and validation steps',
]);

console.log('renderer-chat-history-test: ok');
