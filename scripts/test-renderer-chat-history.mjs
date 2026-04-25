import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createChatHistoryTabContent } = require(path.join(rootDir, 'dist', 'renderer', 'chat', 'history.js'));

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
    this._textContent = '';
    this._innerHTML = '';
    this.hidden = false;
    this.open = false;
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
    for (const listener of this.eventListeners.get(type) ?? []) {
      listener();
    }
  }

  click() {
    this.dispatchEvent('click');
  }

  scrollIntoView() {}
}

globalThis.HTMLElement = FakeElement;
globalThis.document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },
};
globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 1;
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

function createMessage(messageId, text, createdAt, contentType = 'text', reasoning = null) {
  return {
    messageId,
    role: 'assistant',
    text,
    createdAt,
    updatedAt: null,
    contentType,
    reasoning,
  };
}

const tab = {
  id: 'chat:project-1:chat-1',
  title: 'Chat 1',
  projectId: 'project-1',
  chatId: 'chat-1',
  status: 'ready',
  message: null,
  history: {
    projectId: 'project-1',
    projectName: 'Project 1',
    chatId: 'chat-1',
    chatName: 'Chat 1',
    messageCount: 3,
    messages: [
      createMessage('44d5a24f-8cf8-4927-9617-fa9d08df4f80', 'first assistant answer', '2026-04-25T05:39:49.573Z'),
      createMessage('57565292-2b9b-41d9-a1b3-ecee8e341d89', 'second assistant answer', '2026-04-25T05:39:51.806Z'),
      createMessage('673bc037-a4b1-402f-adf4-eeae3bfa9f64', 'Thought for 19s', '2026-04-25T05:40:11.431Z', 'reasoning_recap', {
        recap: 'Thought for 19s',
        steps: [
          { summary: 'Planning MVP PoC for user request', content: 'planning step', chunks: ['planning step'] },
          { summary: 'Outlining MVP PoC and validation steps', content: 'validation step', chunks: ['validation step'] },
        ],
      }),
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
  formatChatMessageTimestamp: (message) => message.createdAt ?? '',
  renderMessageMarkdown: (message) => message.text,
  renderMarkdown: (markdown) => markdown,
  renderGenericFileIcon: () => 'file',
});

const messagesElement = findByClass(shell, 'chat-history-messages');
assert.ok(messagesElement);
assert.equal(messagesElement.children.length, 3);

const rawJsonElement = findByClass(shell, 'chat-history-raw-json');
assert.ok(rawJsonElement);
assert.equal(rawJsonElement.hidden, true);
const rawJsonContent = findByClass(rawJsonElement, 'chat-history-raw-json__content');
assert.ok(rawJsonContent);
assert.match(rawJsonContent.textContent, /\n  "messages": \[\n/);
assert.match(rawJsonContent.textContent, /673bc037-a4b1-402f-adf4-eeae3bfa9f64/);

const viewToggle = findByClass(shell, 'chat-history-view-toggle');
assert.ok(viewToggle);
assert.equal(viewToggle.children.length, 2);
assert.equal(viewToggle.children[0].getAttribute('aria-pressed'), 'true');
assert.equal(viewToggle.children[1].getAttribute('aria-pressed'), 'false');

viewToggle.children[1].click();
assert.equal(tab.viewMode, 'raw-json');
assert.equal(messagesElement.hidden, true);
assert.equal(rawJsonElement.hidden, false);
assert.ok(hasClass(shell, 'chat-history-shell--raw-json'));
assert.equal(viewToggle.children[0].getAttribute('aria-pressed'), 'false');
assert.equal(viewToggle.children[1].getAttribute('aria-pressed'), 'true');

viewToggle.children[0].click();
assert.equal(tab.viewMode, 'markdown');
assert.equal(messagesElement.hidden, false);
assert.equal(rawJsonElement.hidden, true);
assert.ok(!hasClass(shell, 'chat-history-shell--raw-json'));

const [first, second, thought] = messagesElement.children;
assert.ok(hasClass(first, 'chat-message'));
assert.ok(hasClass(second, 'chat-message'));
assert.ok(hasClass(thought, 'chat-reasoning'));
assert.equal(findByClass(first, 'chat-message__markdown')?.innerHTML, 'first assistant answer');
assert.equal(findByClass(second, 'chat-message__markdown')?.innerHTML, 'second assistant answer');
assert.equal(findByClass(thought, 'chat-reasoning__label')?.textContent, 'Thought for 19s');
assert.equal(findByClass(thought, 'chat-reasoning__meta')?.textContent, '2 steps');
assert.equal(findAllByClass(thought, 'chat-message--nested').length, 0);
assert.deepEqual(findAllByClass(thought, 'chat-reasoning__step-header').map((element) => element.textContent), [
  'Planning MVP PoC for user request',
  'Outlining MVP PoC and validation steps',
]);

console.log('renderer-chat-history-test: ok');
