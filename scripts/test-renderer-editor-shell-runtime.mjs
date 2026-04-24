import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const { createRendererEditorFeatureBaseOptions } = require(path.join(rootDir, 'dist', 'renderer', 'editor', 'shell-runtime.js'));

function createStorage() {
  const values = new Map();
  return {
    values,
    storage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };
}

const { storage, values } = createStorage();
const store = createRendererStore({ storage });
const chatTab = {
  id: 'chat:project-1:chat-1',
  kind: 'chat',
  projectId: 'project-1',
  chatId: 'chat-1',
  title: 'Chat 1',
  status: 'ready',
  history: null,
  message: null,
  requestToken: 0,
  inFlightRequest: null,
  reloadAfterLoad: false,
  historyRevisionKey: null,
  pendingHistoryRevisionKey: null,
  isHistoryStale: false,
  renderedContent: null,
};
store.editor.editorTabs = [{ id: 'browser', kind: 'browser', title: 'Browser' }, chatTab];
store.editor.activeEditorTabId = chatTab.id;
store.editor.activePairedEditorSubtab = 'browser';
store.browser.browserOpenedSidebarItem = { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' };

const options = createRendererEditorFeatureBaseOptions({
  limits: {
    maxOpenChatTabs: 8,
    maxOpenPromptTabs: 4,
    editorTabBaseWidthPx: 220,
    editorTabMinWidthPx: 140,
  },
  appState: { currentState: null },
  workspaceState: { selectedSidebarItem: { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' } },
  browserState: store.browser,
  editorState: store.editor,
  store,
  desktopPoc: {
    readPrompt: async (promptId) => ({
      prompt: { promptId, promptName: 'Prompt', promptPath: '/Prompt.md', updatedAt: '2026-04-23T00:00:00.000Z' },
      content: 'Hello',
    }),
    writePrompt: async (promptId, content) => ({
      promptId,
      promptName: content,
      promptPath: '/Prompt.md',
      updatedAt: '2026-04-23T00:00:00.000Z',
    }),
    getChatHistory: async () => null,
  },
  storage,
  storageKeys: {
    lastActiveLocalChat: 'renderer.last-active-local-chat',
  },
  setSelectedSidebarItem() {},
  getPairedChatEditorTab: () => chatTab,
  renderApp() {},
  renderEditorArea() {},
  addDebugLog() {},
  queries: {
    findSidebarProject() { return null; },
    findPersistentSidebarProject() { return null; },
    findSidebarChat() { return null; },
    resolveChatBrowserUrl() { return 'https://chatgpt.com/c/project-1/chat-1'; },
    buildChatBrowserUrl() { return 'https://chatgpt.com/c/project-1/chat-1'; },
  },
  markdownRenderer: {
    render(markdown) {
      return `<p>${markdown}</p>`;
    },
  },
  formatters: {
    escapeHtml(value) { return String(value ?? ''); },
    formatTimestamp(value) { return value ?? ''; },
    formatTreeTimestamp(value) { return value ?? ''; },
    formatFileSize(value) { return String(value ?? ''); },
  },
  icons: {
    renderBrowserTabIcon() { return '<svg data-icon="browser"></svg>'; },
    renderChatIcon() { return '<svg data-icon="chat"></svg>'; },
    renderPromptIcon() { return '<svg data-icon="prompt"></svg>'; },
    renderCloseIcon() { return '<svg data-icon="close"></svg>'; },
    renderGenericFileIcon() { return '<svg data-icon="file"></svg>'; },
  },
  elements: {
    editorTabsElement: null,
    promptViewPanelElement: null,
    promptEditorViewElement: null,
    workbenchElement: null,
    browserToolbarElement: null,
    browserToolbarControlsElement: null,
    browserAddressFormElement: null,
    browserViewElement: null,
    chatHistoryViewElement: null,
    browserElement: null,
  },
});

assert.equal(options.maxOpenChatTabs, 8);
assert.equal(options.renderBrowserTabIcon(), '<svg data-icon="browser"></svg>');
assert.equal(typeof options.persistActiveLocalChatSelection, 'function');

options.persistActiveLocalChatSelection();
assert.equal(
  values.get('renderer.last-active-local-chat'),
  JSON.stringify({ kind: 'chat', projectId: 'project-1', chatId: 'chat-1' }),
);

store.editor.activeEditorTabId = 'browser';
store.editor.activePairedEditorSubtab = 'local';
options.persistActiveLocalChatSelection();
assert.equal(
  values.get('renderer.last-active-local-chat'),
  JSON.stringify({ kind: 'chat', projectId: 'project-1', chatId: 'chat-1' }),
);

store.editor.activePairedEditorSubtab = 'browser';
options.persistActiveLocalChatSelection();
assert.equal(values.has('renderer.last-active-local-chat'), false);

console.log('renderer-editor-shell-runtime-test: ok');
