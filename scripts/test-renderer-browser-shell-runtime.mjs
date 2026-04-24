import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const {
  createRendererBrowserFeatureBaseOptions,
  createRendererBrowserBindingsSlice,
} = require(path.join(rootDir, 'dist', 'renderer', 'browser', 'shell-runtime.js'));

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

const { storage } = createStorage();
const store = createRendererStore({ storage });
store.workspace.selectedSidebarItem = { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' };
store.remoteFiles.downloadAutomatically = true;

let selectedSidebarItem = null;
const options = createRendererBrowserFeatureBaseOptions({
  appState: { currentState: null },
  workspaceState: store.workspace,
  remoteFilesState: store.remoteFiles,
  browserState: store.browser,
  workbenchHost: {
    setActiveEditorTabId(tabId) {
      store.editor.activeEditorTabId = tabId;
    },
    setActivePairedEditorSubtab(value) {
      store.editor.activePairedEditorSubtab = value;
    },
  },
  store,
  storage,
  storageKeys: {
    browserOpened: 'renderer.browser-opened',
    lastActiveLocalChat: 'renderer.last-local-chat',
  },
  setSelectedSidebarItem(selection) {
    selectedSidebarItem = selection;
  },
  browserController: {
    openUrl() {},
    refreshNavigationState() {},
  },
  browserElement: null,
  renderApp() {},
  renderEditorArea() {},
  queries: {
    findSidebarProject() { return null; },
    findPersistentSidebarProject() { return null; },
    findSidebarChat() { return null; },
    getAllSidebarProjects() { return []; },
    getLatestNewFiles() { return []; },
    getChatFileKey(file) { return `${file.chatId}:${file.messageId}:${file.sandboxPath}`; },
    resolveChatBrowserUrl() { return 'https://chatgpt.com/c/project-1/chat-1'; },
    resolveProjectBrowserUrl() { return 'https://chatgpt.com/g/project-1'; },
  },
});

assert.equal(options.browserOpenedStorageKey, 'renderer.browser-opened');
assert.equal(options.lastActiveLocalChatStorageKey, 'renderer.last-local-chat');
assert.equal(options.getSelectedSidebarItem(), store.workspace.selectedSidebarItem);
assert.equal(options.getDownloadAutomatically(), true);

options.setSelectedSidebarItem({ kind: 'chat', projectId: 'project-2', chatId: 'chat-2' });
assert.deepEqual(selectedSidebarItem, { kind: 'chat', projectId: 'project-2', chatId: 'chat-2' });

options.setBrowserOpenedSidebarItem({ kind: 'chat', projectId: 'project-3', chatId: 'chat-3' });
assert.deepEqual(store.browser.browserOpenedSidebarItem, { kind: 'chat', projectId: 'project-3', chatId: 'chat-3' });

options.setHasRestoredLastOpenState(true);
assert.equal(store.browser.hasRestoredLastOpenState, true);

options.setBrowserNavigationState({
  browserCanGoBack: true,
  browserCanGoForward: false,
  browserIsLoading: true,
  pendingBrowserUrl: 'https://chatgpt.com/c/project-3/chat-3',
});
assert.deepEqual(options.getBrowserNavigationState(), {
  browserCanGoBack: true,
  browserCanGoForward: false,
  browserIsLoading: true,
  pendingBrowserUrl: 'https://chatgpt.com/c/project-3/chat-3',
});

options.setActiveEditorTabId('browser');
options.setActivePairedEditorSubtab('local');
assert.equal(store.editor.activeEditorTabId, 'browser');
assert.equal(store.editor.activePairedEditorSubtab, 'local');
assert.equal(options.fileDownloadStatuses, store.remoteFiles.fileDownloadStatuses);

const browserActionCalls = {
  persist: 0,
  queued: 0,
  sent: [],
};
const bindingsSlice = createRendererBrowserBindingsSlice({
  browserState: store.browser,
  getFeature() {
    return {
      actions: {
        persistBrowserOpenedSelection() {
          browserActionCalls.persist += 1;
        },
        sendBrowserFileCommand(command, file) {
          browserActionCalls.sent.push({ command, file });
        },
        queueAutomaticSandboxDownloads() {
          browserActionCalls.queued += 1;
        },
      },
    };
  },
  resolveChatBrowserUrl() {
    return 'https://chatgpt.com/c/project-1/chat-1';
  },
  resolveProjectBrowserUrl() {
    return 'https://chatgpt.com/g/project-1';
  },
});

bindingsSlice.state.setBrowserOpenedSidebarItem({ kind: 'project', projectId: 'project-7' });
assert.deepEqual(store.browser.browserOpenedSidebarItem, { kind: 'project', projectId: 'project-7' });

bindingsSlice.state.persistBrowserOpenedSelection();
bindingsSlice.actions.persistBrowserOpenedSelection();
assert.equal(browserActionCalls.persist, 2);

const testFile = { chatId: 'chat-1', messageId: 'message-1', sandboxPath: '/sandbox/file.txt' };
bindingsSlice.actions.sendBrowserFileCommand('download', testFile);
assert.deepEqual(browserActionCalls.sent, [{ command: 'download', file: testFile }]);

bindingsSlice.actions.queueAutomaticSandboxDownloads();
assert.equal(browserActionCalls.queued, 1);
assert.equal(bindingsSlice.actions.resolveProjectBrowserUrl({ projectId: 'project-1' }), 'https://chatgpt.com/g/project-1');
assert.equal(bindingsSlice.actions.resolveChatBrowserUrl({ projectId: 'project-1' }, { id: 'chat-1' }), 'https://chatgpt.com/c/project-1/chat-1');

console.log('renderer-browser-shell-runtime-test: ok');
