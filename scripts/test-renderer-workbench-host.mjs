import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererWorkbenchHost } = require(path.join(rootDir, 'dist', 'renderer', 'workbench', 'host.js'));

const appState = {
  currentState: {
    projects: [],
    projectBundles: [],
    prompts: [],
    lastUpdatedAt: null,
    lastContext: null,
  },
};

const editorState = {
  editorTabs: [
    { id: 'browser', kind: 'browser', title: 'Browser' },
    { id: 'chat:project-1:chat-1', kind: 'chat', title: 'Chat', projectId: 'project-1', chatId: 'chat-1', isLoaded: false, isLoading: false, error: null, history: null },
  ],
  activeEditorTabId: 'browser',
  activePairedEditorSubtab: 'browser',
};

let browserSyncCount = 0;
let renderAreaCount = 0;
let renderPromptSidebarPanelCount = 0;
let syncSelectionCount = 0;
let persistActiveLocalChatSelectionCount = 0;
let loadChatHistoryArgs = null;
let loadPromptArgs = null;
let savePromptArgs = null;
let handleChatHistoryUpdatedArgs = null;
let openPromptTabArgs = null;
let enterPromptEditModeArgs = null;
let cancelPromptEditingArgs = null;
let closeEditorTabArgs = null;
let activatePairedEditorViewArgs = null;
let activateEditorTabArgs = null;
let openChatHistoryTabArgs = null;
let isBrowserPairedWithChatArgs = null;
let openBrowserForPairedChatArgs = null;
let openLocalChatInChatGptArgs = null;

const chatTab = editorState.editorTabs[1];
const promptTab = {
  id: 'prompt:prompt-1',
  kind: 'prompt',
  title: 'Prompt 1',
  promptId: 'prompt-1',
  content: '',
  isLoaded: true,
  isDirty: false,
  isSaving: false,
  isEditing: false,
  error: null,
};
const project = {
  projectId: 'project-1',
  title: 'Project 1',
  projectPath: '/repo/project-1',
  chats: [],
  folders: [],
};
const chat = {
  chatId: 'chat-1',
  title: 'Chat 1',
  updatedAt: null,
  url: null,
  files: [],
  isBookmarked: false,
  fileCount: 0,
};

const host = createRendererWorkbenchHost({
  appState,
  editorState,
  persistActiveLocalChatSelection() {
    persistActiveLocalChatSelectionCount += 1;
  },
  getFeatures: () => ({
    browser: () => ({
      selectors: {
        isBrowserPairedWithChat(projectId, chatId) {
          isBrowserPairedWithChatArgs = { projectId, chatId };
          return projectId === 'project-1' && chatId === 'chat-1';
        },
      },
      actions: {
        syncBrowserOpenedSelection(currentState) {
          browserSyncCount += 1;
          assert.equal(currentState, appState.currentState);
        },
        openBrowserForPairedChat(projectId, chatId, activateBrowser = true) {
          openBrowserForPairedChatArgs = { projectId, chatId, activateBrowser };
          return true;
        },
        openLocalChatInChatGpt(projectId, chatId, chatUrl) {
          openLocalChatInChatGptArgs = { projectId, chatId, chatUrl };
        },
      },
    }),
    editor: () => ({
      selectors: {
        findPromptEditorTab(promptId) {
          return promptId === promptTab.promptId ? promptTab : null;
        },
        getChatEditorTabId(projectId, chatId) {
          return `chat:${projectId}:${chatId}`;
        },
      },
      actions: {
        syncSelectionWithActiveEditorTab() {
          syncSelectionCount += 1;
        },
        loadChatHistoryIntoTab(tab, forceReload) {
          loadChatHistoryArgs = { tab, forceReload };
          return Promise.resolve();
        },
        loadPromptIntoTab(tab, forceReload) {
          loadPromptArgs = { tab, forceReload };
          return Promise.resolve();
        },
        savePromptTab(tab) {
          savePromptArgs = tab;
          return Promise.resolve();
        },
        handleChatHistoryUpdated(payload) {
          handleChatHistoryUpdatedArgs = payload;
        },
        openPromptTab(promptId) {
          openPromptTabArgs = promptId;
          return Promise.resolve();
        },
        enterPromptEditMode(tab) {
          enterPromptEditModeArgs = tab;
        },
        cancelPromptEditing(tab) {
          cancelPromptEditingArgs = tab;
        },
        closeEditorTab(tabId) {
          closeEditorTabArgs = tabId;
        },
        activatePairedEditorView(view) {
          activatePairedEditorViewArgs = view;
        },
        activateEditorTab(tabId) {
          activateEditorTabArgs = tabId;
        },
        openChatHistoryTab(projectValue, chatValue) {
          openChatHistoryTabArgs = { project: projectValue, chat: chatValue };
          return Promise.resolve();
        },
      },
      render: {
        area() {
          renderAreaCount += 1;
        },
        promptSidebarPanel() {
          renderPromptSidebarPanelCount += 1;
        },
      },
    }),
  }),
});

assert.equal(host.getActiveEditorTabId(), 'browser');
host.setActiveEditorTabId('chat:project-1:chat-1');
assert.equal(editorState.activeEditorTabId, 'chat:project-1:chat-1');
host.setActivePairedEditorSubtab('local');
assert.equal(editorState.activePairedEditorSubtab, 'local');
assert.equal(host.hasEditorTab('browser'), true);
assert.equal(host.hasEditorTab('missing'), false);

host.renderEditorArea();
assert.equal(renderAreaCount, 1);

const browserControllerHooks = host.createBrowserControllerHooks();
browserControllerHooks.activateBrowserTab();
assert.equal(editorState.activeEditorTabId, 'browser');
browserControllerHooks.renderActivatedView();
assert.equal(renderAreaCount, 2);

const bootstrapSlice = host.createBootstrapSlice();
bootstrapSlice.actions.handleChatHistoryUpdated({
  projectId: 'project-1',
  chatId: 'chat-1',
  revisionKey: 'rev-1',
  updatedAt: '2026-04-23T00:00:00.000Z',
  capturedAt: '2026-04-23T00:00:01.000Z',
  messageCount: 3,
  isPartial: false,
});
assert.deepEqual(handleChatHistoryUpdatedArgs, {
  projectId: 'project-1',
  chatId: 'chat-1',
  revisionKey: 'rev-1',
  updatedAt: '2026-04-23T00:00:00.000Z',
  capturedAt: '2026-04-23T00:00:01.000Z',
  messageCount: 3,
  isPartial: false,
});

const bindingsSlice = host.createBindingsSlice();
const bindingsActions = bindingsSlice.actions;
assert.equal(bindingsActions.hasEditorTab('chat:project-1:chat-1'), true);
await bindingsActions.openPromptTab('prompt-1');
assert.equal(openPromptTabArgs, 'prompt-1');
assert.equal(bindingsActions.findPromptEditorTab('prompt-1'), promptTab);
bindingsActions.enterPromptEditMode('prompt-1');
assert.equal(enterPromptEditModeArgs, promptTab);
bindingsActions.savePromptTab('prompt-1');
assert.equal(savePromptArgs, promptTab);
bindingsActions.cancelPromptEditing('prompt-1');
assert.equal(cancelPromptEditingArgs, promptTab);
bindingsActions.closeEditorTab('chat:project-1:chat-1');
assert.equal(closeEditorTabArgs, 'chat:project-1:chat-1');
bindingsActions.activatePairedEditorView('local');
assert.equal(activatePairedEditorViewArgs, 'local');
bindingsActions.activateEditorTab('chat:project-1:chat-1');
assert.equal(activateEditorTabArgs, 'chat:project-1:chat-1');
await bindingsActions.openChatHistoryTab(project, chat);
assert.deepEqual(openChatHistoryTabArgs, { project, chat });
assert.equal(bindingsActions.getChatEditorTabId('project-1', 'chat-1'), 'chat:project-1:chat-1');
assert.equal(bindingsActions.isBrowserPairedWithChat('project-1', 'chat-1'), true);
assert.deepEqual(isBrowserPairedWithChatArgs, { projectId: 'project-1', chatId: 'chat-1' });
assert.equal(bindingsActions.openBrowserForPairedChat('project-1', 'chat-1', false), true);
assert.deepEqual(openBrowserForPairedChatArgs, { projectId: 'project-1', chatId: 'chat-1', activateBrowser: false });
bindingsActions.openLocalChatInChatGpt('project-1', 'chat-1', 'https://chatgpt.com/c/project-1/chat-1');
assert.deepEqual(openLocalChatInChatGptArgs, { projectId: 'project-1', chatId: 'chat-1', chatUrl: 'https://chatgpt.com/c/project-1/chat-1' });

host.renderWorkbench();
assert.equal(browserSyncCount, 1);
assert.equal(renderAreaCount, 3);
assert.equal(renderPromptSidebarPanelCount, 1);

const renderHooks = host.createContextRenderHooks();
renderHooks.renderEditorArea();
assert.equal(renderAreaCount, 4);
renderHooks.syncSelectionWithActiveEditorTab();
assert.equal(syncSelectionCount, 1);
renderHooks.persistActiveLocalChatSelection();
assert.equal(persistActiveLocalChatSelectionCount, 1);
await renderHooks.loadChatHistoryIntoTab(chatTab, true);
assert.deepEqual(loadChatHistoryArgs, { tab: chatTab, forceReload: true });
await renderHooks.loadPromptIntoTab(promptTab, false);
assert.deepEqual(loadPromptArgs, { tab: promptTab, forceReload: false });
await renderHooks.savePromptTab(promptTab);
assert.equal(savePromptArgs, promptTab);

appState.currentState = null;
host.renderWorkbench();
assert.equal(browserSyncCount, 1);
assert.equal(renderAreaCount, 4);
assert.equal(renderPromptSidebarPanelCount, 1);

console.log('renderer-workbench-host-test: ok');
