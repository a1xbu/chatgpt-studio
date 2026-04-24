import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererUiRefs } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'ui-refs.js'));
const { createRendererAppServices } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'services.js'));
const { rendererShellConfig } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'shell-config.js'));

function createElement(tagName = 'div') {
  return {
    tagName: tagName.toUpperCase(),
    id: '',
    children: [],
    append(child) {
      this.children.push(child);
    },
  };
}

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

const elements = new Map();
for (const id of requiredIds) {
  const element = createElement();
  element.id = id;
  elements.set(id, element);
}

const body = createElement('body');
const documentLike = {
  body,
  createElement(tagName) {
    return createElement(tagName);
  },
  getElementById(id) {
    return elements.get(id) ?? body.children.find((child) => child.id === id) ?? null;
  },
  querySelector(selector) {
    if (selector === '.sidebar-content' || selector === '.sidebar' || selector === '.workbench' || selector === '.browser-toolbar-controls') {
      return createElement();
    }
    return null;
  },
};

const firstRefs = createRendererUiRefs(documentLike);
assert.equal(firstRefs.overlayRootElement.id, 'overlay-root');
assert.equal(body.children.length, 1);
assert.equal(firstRefs.browserUrlElement?.id, 'browser-url');
assert.equal(firstRefs.promptViewPanelElement?.id, 'prompt-view-panel');

const secondRefs = createRendererUiRefs(documentLike);
assert.equal(body.children.length, 1);
assert.equal(secondRefs.overlayRootElement, firstRefs.overlayRootElement);

const fakeWindow = {
  tag: 'renderer-window',
  setTimeout(callback, delayMs) {
    assert.equal(this.tag, 'renderer-window');
    callback();
    return delayMs;
  },
  clearTimeout(timerId) {
    assert.equal(this.tag, 'renderer-window');
    return timerId;
  },
  requestAnimationFrame(callback) {
    assert.equal(this.tag, 'renderer-window');
    callback(16);
    return 16;
  },
};

const browserController = { name: 'browser-controller' };
const desktopPoc = { name: 'desktop-poc' };
const storage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};
const clipboard = {
  async writeText() {},
};

const services = createRendererAppServices({
  windowLike: fakeWindow,
  desktopPoc,
  browserController,
  clipboard,
  storage,
});

assert.equal(services.desktopPoc, desktopPoc);
assert.equal(services.browserController, browserController);
assert.equal(services.storage, storage);
assert.equal(services.clipboard, clipboard);
assert.equal(services.timers.setTimeout(() => {}, 12), 12);
assert.equal(services.timers.requestAnimationFrame(() => {}), 16);
services.timers.clearTimeout(7);

assert.equal(rendererShellConfig.storage.sidebarWidthKey, 'desktop-poc.sidebar-width');
assert.equal(rendererShellConfig.layout.minSidebarWidth, 240);
assert.equal(rendererShellConfig.editor.maxOpenChatTabs, 5);

console.log('renderer-foundation-test: ok');
