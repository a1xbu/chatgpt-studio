import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const { createRendererPromptsFeatureBaseOptions } = require(path.join(rootDir, 'dist', 'renderer', 'prompts', 'shell-runtime.js'));

function createStorage() {
  const values = new Map();
  return {
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
store.editor.promptDirectoryPath = '/prompts';
store.editor.prompts = [{ id: 'prompt-1', promptName: 'Prompt 1', promptPath: '/prompts/prompt-1.md', updatedAt: '2026-04-23T00:00:00.000Z' }];
store.dialogs.propertiesDialogState = { kind: 'project', projectId: 'project-1' };

const calls = [];
const options = createRendererPromptsFeatureBaseOptions({
  appState: store.app,
  dialogState: store.dialogs,
  editorState: store.editor,
  store,
  desktopPoc: {
    listPrompts: async () => ({ promptDirectoryPath: '/prompts', prompts: [] }),
    readPrompt: async (promptId) => ({
      prompt: { id: promptId, promptName: 'Prompt', promptPath: `/prompts/${promptId}.md`, updatedAt: '2026-04-23T00:00:00.000Z' },
      content: 'Prompt content',
    }),
    createPrompt: async (name) => ({ id: 'created', promptName: name, promptPath: `/prompts/${name}.md`, updatedAt: '2026-04-23T00:00:00.000Z' }),
    renamePrompt: async (promptId, name) => ({ id: promptId, promptName: name, promptPath: `/prompts/${name}.md`, updatedAt: '2026-04-23T00:00:00.000Z' }),
    deletePrompt: async (promptId) => {
      calls.push(['deletePrompt', promptId]);
    },
  },
  renderApp() {
    calls.push(['renderApp']);
  },
  elements: {
    promptViewPanelElement: null,
    overlayRootElement: { id: 'overlay-root' },
  },
  environment: {
    documentLike: { body: {} },
    bodyElement: { id: 'body' },
    windowLike: { alert() {} },
  },
  remoteManifestFile: 'remote-manifest.md',
  helpers: {
    getChatFileKey(file) { return `${file.projectId}:${file.chatId}:${file.messageId}`; },
    findLatestNewFileByKey() { return null; },
    getRemoteManifestPrompt(projectId) { return `prompt:${projectId}`; },
    findSidebarProject() { return null; },
    findSidebarChat() { return null; },
    formatTimestamp(value) { return value ?? ''; },
    escapeHtml(value) { return String(value ?? ''); },
    renderOpenFolderIcon() { return '<svg data-icon="open-folder"></svg>'; },
    renderFileTreeFileIcon() { return '<svg data-icon="file"></svg>'; },
    renderSharedFileTreeItem() { return '<div>tree-item</div>'; },
    renderSharedFileTreeActionButton() { return '<button>action</button>'; },
    renderMoreActionsIcon() { return '<svg data-icon="more"></svg>'; },
  },
  timers: {
    setTimeoutImpl(callback, delay) {
      calls.push(['setTimeout', delay]);
      callback();
      return 1;
    },
    clearTimeoutImpl(timerId) {
      calls.push(['clearTimeout', timerId]);
    },
  },
});

assert.equal(options.getPromptDirectoryPath(), '/prompts');
assert.deepEqual(options.getPrompts(), store.editor.prompts);
assert.equal(options.promptContentCache, store.editor.promptContentCache);
assert.equal(options.remoteManifestFile, 'remote-manifest.md');
assert.equal(options.getPropertiesDialogState(), store.dialogs.propertiesDialogState);
assert.equal(options.getPromptMenuRuntimeState().activePromptMenu, null);

options.setPromptDirectoryPath('/next-prompts');
options.setPrompts([]);
options.setActiveEditorTabId('browser');
options.setPromptNameDialogState({ mode: 'create', title: 'Create', confirmLabel: 'Save', promptId: null, initialValue: '', errorMessage: null });
options.setArchiveApplyWarningDialogState({ fileKey: 'project-1:chat-1:message-1:path' });
options.setPropertiesDialogState({ kind: 'chat', projectId: 'project-1', chatId: 'chat-1' });
options.setPromptMenuRuntimeState({ activePromptMenu: { promptId: 'prompt-1' }, activePromptMenuCloseTimer: 7 });

assert.equal(store.editor.promptDirectoryPath, '/next-prompts');
assert.deepEqual(store.editor.prompts, []);
assert.equal(store.editor.activeEditorTabId, 'browser');
assert.equal(store.dialogs.promptNameDialogState?.mode, 'create');
assert.equal(store.dialogs.archiveApplyWarningDialogState?.fileKey, 'project-1:chat-1:message-1:path');
assert.deepEqual(store.dialogs.propertiesDialogState, { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' });
assert.equal(store.menus.activePromptMenu?.promptId, 'prompt-1');
assert.equal(store.menus.activePromptMenuCloseTimer, 7);

await options.deletePromptRecord('prompt-1');
assert.deepEqual(calls, [['deletePrompt', 'prompt-1']]);

console.log('renderer-prompts-shell-runtime-test: ok');
