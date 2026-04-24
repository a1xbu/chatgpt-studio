import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createEditorFeature } = require(path.join(rootDir, 'dist', 'renderer', 'editor', 'feature.js'));
const { getChatHistoryRevisionKey } = require(path.join(rootDir, 'dist', 'shared', 'chat-history-revision.js'));

function createHistory(updatedAt, text) {
  return {
    projectId: 'project-1',
    projectName: 'Project 1',
    chatId: 'chat-1',
    chatName: 'Chat 1',
    messageCount: 1,
    messages: [
      {
        messageId: `message-${updatedAt}`,
        role: 'assistant',
        text,
        createdAt: updatedAt,
        updatedAt,
        contentType: 'text/plain',
        reasoning: null,
      },
    ],
    searchText: text.toLowerCase(),
    updatedAt,
    capturedAt: updatedAt,
    isPartial: false,
  };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const project = {
  projectId: 'project-1',
  projectName: 'Project 1',
  folderPath: '/repo/project-1',
  projectUrl: 'https://chatgpt.com/g/g-project-1',
  status: 'persistent',
  chats: [],
  files: [],
  bundle: null,
  lastSeenAt: '2026-04-23T00:00:00.000Z',
};
const chat = {
  chatId: 'chat-1',
  chatName: 'Chat 1',
  projectId: 'project-1',
  projectName: 'Project 1',
  chatUrl: 'https://chatgpt.com/c/chat-1',
  updatedAt: '2026-04-23T00:00:00.000Z',
};
let browserOpenedSidebarItem = { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' };

const currentState = {
  browserUrl: 'https://chatgpt.com',
  lastContext: null,
  temporaryProjects: [],
  persistentProjects: [project],
};

let nextHistory = createHistory('2026-04-23T00:00:00.000Z', 'Initial content');
let getChatHistoryCalls = 0;
let runtimeState = {
  editorTabs: [
    { id: 'browser', kind: 'browser', title: 'Browser' },
    {
      id: 'chat:project-1:chat-1',
      kind: 'chat',
      projectId: 'project-1',
      chatId: 'chat-1',
      title: 'Chat 1',
      status: 'ready',
      history: nextHistory,
      message: null,
      requestToken: 0,
      inFlightRequest: null,
      reloadAfterLoad: false,
      historyRevisionKey: getChatHistoryRevisionKey(nextHistory),
      pendingHistoryRevisionKey: null,
      isHistoryStale: false,
      renderedContent: { nodeName: 'DIV' },
    },
  ],
  activeEditorTabId: 'browser',
  activePairedEditorSubtab: 'browser',
};

const feature = createEditorFeature({
  maxOpenChatTabs: 8,
  maxOpenPromptTabs: 4,
  editorTabBaseWidthPx: 220,
  editorTabMinWidthPx: 140,
  getCurrentState: () => currentState,
  getSelectedSidebarItem: () => ({ kind: 'chat', projectId: 'project-1', chatId: 'chat-1' }),
  setSelectedSidebarItem() {},
  getBrowserOpenedSidebarItem: () => browserOpenedSidebarItem,
  getPrompts: () => [],
  promptContentCache: new Map(),
  readPrompt: async () => null,
  writePrompt: async () => ({ id: 'prompt-1', title: 'Prompt', fileName: 'prompt.md', fullPath: '/prompts/prompt.md', updatedAt: '2026-04-23T00:00:00.000Z', createdAt: '2026-04-23T00:00:00.000Z', sizeBytes: 10 }),
  refreshPrompts: async () => {},
  getEditorRuntimeState: () => runtimeState,
  setEditorRuntimeState: (nextState) => {
    runtimeState = nextState;
  },
  getLastRenderedPromptEditorStateKey: () => '',
  setLastRenderedPromptEditorStateKey() {},
  findSidebarProject: () => project,
  findPersistentSidebarProject: () => project,
  findSidebarChat: () => chat,
  resolveChatBrowserUrl: () => chat.chatUrl,
  buildChatBrowserUrl: () => chat.chatUrl,
  renderApp() {},
  renderPromptMenuPortal() {},
  renderPromptViewPanel() { return ''; },
  persistActiveLocalChatSelection() {},
  addDebugLog() {},
  getChatHistory: async () => {
    getChatHistoryCalls += 1;
    return nextHistory;
  },
  markdownRenderer: { render(markdown) { return `<p>${markdown}</p>`; } },
  escapeHtml(value) { return String(value ?? ''); },
  formatTimestamp(value) { return value ?? ''; },
  formatTreeTimestamp(value) { return value ?? ''; },
  formatFileSize(value) { return String(value ?? ''); },
  renderBrowserTabIcon() { return ''; },
  renderChatIcon() { return ''; },
  renderPromptIcon() { return ''; },
  renderCloseIcon() { return ''; },
  renderGenericFileIcon() { return ''; },
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
});

const chatTab = feature.selectors.findChatEditorTab('project-1', 'chat-1');
assert.ok(chatTab);

browserOpenedSidebarItem = { kind: 'chat', projectId: 'project-1', chatId: 'chat-2' };
feature.actions.handleChatHistoryUpdated({
  projectId: 'project-1',
  chatId: 'chat-1',
  revisionKey: 'rev-ignore',
  updatedAt: '2026-04-23T00:01:00.000Z',
  capturedAt: '2026-04-23T00:01:00.000Z',
  messageCount: 1,
  isPartial: false,
});
await flush();
assert.equal(getChatHistoryCalls, 0);
assert.equal(chatTab.isHistoryStale, false);
assert.equal(chatTab.pendingHistoryRevisionKey, null);

browserOpenedSidebarItem = { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' };
feature.actions.markChatHistoryTabStale('project-1', 'chat-1');
assert.equal(chatTab.isHistoryStale, true);
assert.equal(chatTab.pendingHistoryRevisionKey, null);

nextHistory = createHistory('2026-04-23T00:10:00.000Z', 'Visible revision');
const visiblePayload = {
  projectId: 'project-1',
  chatId: 'chat-1',
  revisionKey: getChatHistoryRevisionKey(nextHistory),
  updatedAt: nextHistory.updatedAt,
  capturedAt: nextHistory.capturedAt,
  messageCount: nextHistory.messageCount,
  isPartial: false,
};
feature.actions.handleChatHistoryUpdated(visiblePayload);
await flush();
assert.equal(getChatHistoryCalls, 0);
assert.equal(chatTab.isHistoryStale, true);
assert.equal(chatTab.pendingHistoryRevisionKey, visiblePayload.revisionKey);

feature.actions.activatePairedEditorView('local');
await flush();
assert.equal(getChatHistoryCalls, 1);
assert.equal(chatTab.isHistoryStale, false);
assert.equal(chatTab.historyRevisionKey, visiblePayload.revisionKey);
assert.equal(chatTab.pendingHistoryRevisionKey, null);

feature.actions.handleChatHistoryUpdated(visiblePayload);
await flush();
assert.equal(getChatHistoryCalls, 1);

nextHistory = createHistory('2026-04-23T00:20:00.000Z', 'Newest visible revision');
const newestPayload = {
  projectId: 'project-1',
  chatId: 'chat-1',
  revisionKey: getChatHistoryRevisionKey(nextHistory),
  updatedAt: nextHistory.updatedAt,
  capturedAt: nextHistory.capturedAt,
  messageCount: nextHistory.messageCount,
  isPartial: false,
};
feature.actions.handleChatHistoryUpdated(newestPayload);
await flush();
assert.equal(getChatHistoryCalls, 2);
assert.equal(chatTab.history?.messages[0]?.text, 'Newest visible revision');
assert.equal(chatTab.historyRevisionKey, newestPayload.revisionKey);
assert.equal(chatTab.isHistoryStale, false);

console.log('renderer-editor-chat-updates-test: ok');
