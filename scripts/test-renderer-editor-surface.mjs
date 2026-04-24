import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { renderEditorSurface } = require(path.join(rootDir, 'dist', 'renderer', 'editor', 'surface.js'));

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      if (token) this.values.add(token);
    }
    this.owner.className = Array.from(this.values).join(' ');
  }

  remove(...tokens) {
    for (const token of tokens) {
      this.values.delete(token);
    }
    this.owner.className = Array.from(this.values).join(' ');
  }

  toggle(token, force) {
    const shouldHave = typeof force === 'boolean' ? force : !this.values.has(token);
    if (shouldHave) {
      this.values.add(token);
    } else {
      this.values.delete(token);
    }
    this.owner.className = Array.from(this.values).join(' ');
    return shouldHave;
  }
}

class FakeElement {
  constructor(tagName = 'div', className = '') {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.children = [];
    this.parentElement = null;
    this.hidden = false;
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList(this);
    this.scrollTop = 0;
    this.scrollHeight = 0;
  }

  get childElementCount() {
    return this.children.length;
  }

  get firstElementChild() {
    return this.children[0] ?? null;
  }

  appendChild(child) {
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  append(child) {
    return this.appendChild(child);
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
  }

  remove() {
    this.parentElement?.removeChild(this);
  }

  replaceChildren(...nextChildren) {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children = [];
    for (const child of nextChildren) {
      this.appendChild(child);
    }
  }

  toggleAttribute(name, force) {
    if (name === 'hidden') {
      this.hidden = typeof force === 'boolean' ? force : !this.hidden;
    }
  }

  querySelector(selector) {
    if (!selector.startsWith('.')) {
      return null;
    }

    const token = selector.slice(1);
    const stack = [...this.children];
    while (stack.length) {
      const current = stack.shift();
      if (!current) {
        continue;
      }
      const classes = String(current.className ?? '').split(/\s+/).filter(Boolean);
      if (classes.includes(token)) {
        return current;
      }
      stack.unshift(...current.children);
    }

    return null;
  }
}

globalThis.HTMLElement = FakeElement;
globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 1;
};

function createChatTab(chatId, title) {
  return {
    id: `chat:project-1:${chatId}`,
    kind: 'chat',
    projectId: 'project-1',
    chatId,
    title,
    status: 'ready',
    history: { chatId, messageCount: 1, messages: [{}] },
    message: null,
    requestToken: 0,
    inFlightRequest: null,
    reloadAfterLoad: false,
    historyRevisionKey: `rev-${chatId}`,
    pendingHistoryRevisionKey: null,
    isHistoryStale: false,
    renderedContent: null,
    historyScrollTop: null,
  };
}

const firstChatTab = createChatTab('chat-1', 'Chat 1');
const secondChatTab = createChatTab('chat-2', 'Chat 2');
const workbenchElement = new FakeElement('div');
const browserToolbarElement = new FakeElement('div');
const browserToolbarControlsElement = new FakeElement('div');
const browserAddressFormElement = new FakeElement('form');
const browserViewElement = new FakeElement('div');
const chatHistoryViewElement = new FakeElement('div');
const promptEditorViewElement = new FakeElement('div');
const browserElement = new FakeElement('webview');

let createCalls = 0;
function createChatHistoryTabContent(tab) {
  createCalls += 1;
  const shell = new FakeElement('div', 'chat-history-shell');
  shell.dataset.title = tab.title;
  const messages = new FakeElement('div', 'chat-history-messages');
  messages.scrollHeight = 400 + createCalls;
  shell.appendChild(messages);
  return shell;
}

function render(activeEditorTabId) {
  renderEditorSurface(
    {
      editorTabs: [{ id: 'browser', kind: 'browser', title: 'Browser' }, firstChatTab, secondChatTab],
      activeEditorTabId,
      activePairedEditorSubtab: 'local',
      lastRenderedPromptEditorStateKey: '',
    },
    {
      workbenchElement,
      browserToolbarElement,
      browserToolbarControlsElement,
      browserAddressFormElement,
      browserViewElement,
      chatHistoryViewElement,
      promptEditorViewElement,
      browserElement,
    },
    {
      getPairedChatSelection: () => null,
      getPairedChatEditorTab: () => null,
      createChatHistoryTabContent,
      createPromptEditorContent: () => new FakeElement('div'),
      renderPromptMenuPortal() {},
    },
  );
}

render(firstChatTab.id);
assert.equal(createCalls, 1);
assert.equal(chatHistoryViewElement.childElementCount, 1);
assert.equal(chatHistoryViewElement.firstElementChild, firstChatTab.renderedContent);
assert.equal(firstChatTab.renderedContent?.dataset.title, 'Chat 1');
assert.equal(firstChatTab.renderedContent?.querySelector('.chat-history-messages')?.scrollTop, 401);

const firstMessages = firstChatTab.renderedContent?.querySelector('.chat-history-messages');
assert.ok(firstMessages);
firstMessages.scrollTop = 211;

render(secondChatTab.id);
assert.equal(createCalls, 2);
assert.equal(chatHistoryViewElement.childElementCount, 2);
assert.equal(secondChatTab.renderedContent?.parentElement, chatHistoryViewElement);
assert.equal(secondChatTab.renderedContent?.hidden, false);
assert.equal(firstChatTab.renderedContent?.hidden, true);
assert.equal(secondChatTab.renderedContent?.dataset.title, 'Chat 2');
assert.equal(secondChatTab.renderedContent?.querySelector('.chat-history-messages')?.scrollTop, 402);

const secondMessages = secondChatTab.renderedContent?.querySelector('.chat-history-messages');
assert.ok(secondMessages);
secondMessages.scrollTop = 133;

render(firstChatTab.id);
assert.equal(createCalls, 2);
assert.equal(chatHistoryViewElement.childElementCount, 2);
assert.equal(firstChatTab.renderedContent?.parentElement, chatHistoryViewElement);
assert.equal(firstChatTab.renderedContent?.hidden, false);
assert.equal(secondChatTab.renderedContent?.hidden, true);
assert.equal(firstChatTab.renderedContent?.dataset.title, 'Chat 1');
assert.equal(firstChatTab.renderedContent?.querySelector('.chat-history-messages')?.scrollTop, 211);
assert.equal(secondChatTab.renderedContent?.querySelector('.chat-history-messages')?.scrollTop, 133);

render('browser');
assert.equal(chatHistoryViewElement.childElementCount, 2);
assert.equal(firstChatTab.renderedContent?.hidden, true);
assert.equal(secondChatTab.renderedContent?.hidden, true);

render(firstChatTab.id);
assert.equal(createCalls, 2);
assert.equal(chatHistoryViewElement.firstElementChild, firstChatTab.renderedContent);
assert.equal(firstChatTab.renderedContent?.querySelector('.chat-history-messages')?.scrollTop, 211);

console.log('renderer-editor-surface-test: ok');
