import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const rendererBundlePath = path.join(rootDir, 'dist', 'renderer', 'renderer.js');
const source = readFileSync(rendererBundlePath, 'utf8');

function createClassList() {
  return {
    add() {},
    remove() {},
    toggle() {},
    contains() { return false; },
  };
}

function createElement(tagName = 'div') {
  return {
    tagName: tagName.toUpperCase(),
    id: '',
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    hidden: false,
    firstElementChild: null,
    dataset: {},
    style: {
      setProperty() {},
      removeProperty() {},
    },
    classList: createClassList(),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    append() {},
    appendChild() {},
    prepend() {},
    remove() {},
    replaceChildren() {},
    setAttribute() {},
    removeAttribute() {},
    toggleAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    contains() { return false; },
    focus() {},
    blur() {},
    scrollIntoView() {},
    getBoundingClientRect() {
      return { width: 320, height: 32, top: 12, left: 12, bottom: 44, right: 332 };
    },
  };
}

const elements = new Map();
const requiredIds = [
  'project-list',
  'new-files-panel',
  'file-view-panel',
  'prompt-view-panel',
  'sidebar-activity',
  'sidebar-panel-explorer',
  'sidebar-panel-files',
  'sidebar-panel-prompts',
  'new-files-panel-resizer',
  'sidebar-details',
  'sidebar-details-resizer',
  'editor-tabs',
  'browser-toolbar',
  'browser-back',
  'browser-forward',
  'browser-refresh-stop',
  'browser-address-form',
  'toggle-debug-panel-bottom',
  'clear-debug',
  'copy-debug',
  'open-terminal',
  'bottom-tabs',
  'browser-url',
  'browser-view',
  'chatgpt-browser',
  'chat-history-view',
  'prompt-editor-view',
  'app-shell',
  'debug-console',
  'debug-filter',
  'debug-retention',
  'debug-view',
  'terminal-view',
  'terminal-pane',
  'terminal-empty',
  'terminal-meta',
  'terminal-host',
  'git-view',
  'sidebar-resizer',
  'bottom-panel-resizer',
  'drag-shield',
];

for (const id of requiredIds) {
  const element = createElement();
  element.id = id;
  elements.set(id, element);
}

const browserElement = elements.get('chatgpt-browser');
browserElement.goBack = () => {};
browserElement.goForward = () => {};
browserElement.reload = () => {};
browserElement.stop = () => {};
browserElement.canGoBack = () => false;
browserElement.canGoForward = () => false;
browserElement.isLoading = () => false;
browserElement.getURL = () => 'https://chatgpt.com';

const document = {
  body: createElement('body'),
  documentElement: createElement('html'),
  getElementById(id) {
    return elements.get(id) ?? null;
  },
  querySelector(selector) {
    if (selector === '.sidebar-content' || selector === '.sidebar' || selector === '.workbench' || selector === '.browser-toolbar-controls') {
      return createElement();
    }
    return null;
  },
  querySelectorAll() {
    return [];
  },
  createElement(tagName) {
    return createElement(tagName);
  },
  addEventListener() {},
};

const bootstrapPayload = {
  state: {
    browserUrl: 'https://chatgpt.com',
    lastContext: null,
    temporaryProjects: [],
    persistentProjects: [],
  },
  debugLogs: [],
  terminalSnapshots: [],
  browser: {
    url: 'https://chatgpt.com',
    partition: 'persist:smoke-test',
    preloadUrl: 'file:///guest-preload.js',
  },
};

const desktopPoc = new Proxy({
  async getBootstrap() {
    return bootstrapPayload;
  },
  async listPrompts() {
    return { prompts: [], activePromptId: null };
  },
  async readPrompt() {
    return { content: '' };
  },
}, {
  get(target, property) {
    if (property in target) {
      return target[property];
    }
    return () => () => {};
  },
});

function MarkdownIt() {
  return {
    render: (sourceText) => sourceText,
    renderInline: (sourceText) => sourceText,
  };
}

function Terminal() {
  this.open = () => {};
  this.loadAddon = () => {};
  this.write = () => {};
  this.reset = () => {};
  this.clear = () => {};
  this.dispose = () => {};
  this.focus = () => {};
  this.onData = () => {};
  this.cols = 100;
  this.rows = 24;
}

function FitAddonCtor() {
  this.fit = () => {};
}

const localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

const context = {
  window: null,
  document,
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame(callback) {
    return setTimeout(callback, 0);
  },
  cancelAnimationFrame(timerId) {
    clearTimeout(timerId);
  },
  navigator: {
    clipboard: {
      async writeText() {},
    },
  },
  localStorage,
  markdownit: MarkdownIt,
  Terminal,
  FitAddon: { FitAddon: FitAddonCtor },
  MutationObserver: function MutationObserver() { this.observe = () => {}; this.disconnect = () => {}; },
  ResizeObserver: function ResizeObserver() { this.observe = () => {}; this.disconnect = () => {}; },
  CustomEvent: function CustomEvent() {},
  Event: function Event() {},
  KeyboardEvent: function KeyboardEvent() {},
  MouseEvent: function MouseEvent() {},
  Element: function Element() {},
  Node: function Node() {},
  HTMLElement: function HTMLElement() {},
  HTMLInputElement: function HTMLInputElement() {},
  HTMLButtonElement: function HTMLButtonElement() {},
  HTMLTextAreaElement: function HTMLTextAreaElement() {},
  HTMLFormElement: function HTMLFormElement() {},
  alert() {},
  confirm() { return true; },
};

context.window = context;
context.window.desktopPoc = desktopPoc;
context.window.markdownit = MarkdownIt;
context.window.localStorage = localStorage;
context.window.innerHeight = 900;
context.window.innerWidth = 1440;
context.window.addEventListener = () => {};
context.window.removeEventListener = () => {};
context.window.getComputedStyle = () => ({ getPropertyValue() { return ''; } });
context.globalThis = context;

try {
  vm.runInNewContext(source, context, { filename: 'renderer.js' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  console.log('renderer-startup-smoke: ok');
} catch (error) {
  console.error('renderer-startup-smoke: failed');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
