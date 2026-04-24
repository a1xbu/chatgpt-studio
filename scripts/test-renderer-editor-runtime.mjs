import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { activateEditorTab, activatePairedEditorView } = require(path.join(rootDir, 'dist', 'renderer', 'editor', 'runtime.js'));

function createChatTab() {
  return {
    id: 'chat:project-1:chat-1',
    kind: 'chat',
    projectId: 'project-1',
    chatId: 'chat-1',
    title: 'Chat 1',
    status: 'ready',
    history: { chatId: 'chat-1', messageCount: 1, messages: [{}] },
    message: null,
    requestToken: 0,
    inFlightRequest: null,
    reloadAfterLoad: false,
    historyRevisionKey: 'rev-1',
    pendingHistoryRevisionKey: null,
    isHistoryStale: false,
    renderedContent: null,
  };
}

{
  const chatTab = createChatTab();
  const loadCalls = [];
  let runtimeState = {
    editorTabs: [{ id: 'browser', kind: 'browser', title: 'Browser' }, chatTab],
    activeEditorTabId: 'browser',
    activePairedEditorSubtab: 'browser',
  };

  activateEditorTab({
    tabId: chatTab.id,
    state: runtimeState,
    setState: (nextState) => {
      runtimeState = nextState;
    },
    getPairedChatEditorTab: () => chatTab,
    persistActiveLocalChatSelection() {},
    syncSelectionWithActiveEditorTab() {},
    render() {},
    renderEditorArea() {},
    loadChatHistoryIntoTab: async (tab, forceReload = false) => {
      loadCalls.push({ tabId: tab.id, forceReload });
    },
    loadPromptIntoTab: async () => {},
    savePromptTab() {},
  });

  assert.equal(runtimeState.activeEditorTabId, chatTab.id);
  assert.deepEqual(loadCalls, []);
}


{
  const firstChatTab = createChatTab();
  const secondChatTab = {
    ...createChatTab(),
    id: 'chat:project-1:chat-2',
    chatId: 'chat-2',
    title: 'Chat 2',
    historyRevisionKey: 'rev-2',
  };
  const loadCalls = [];
  let runtimeState = {
    editorTabs: [{ id: 'browser', kind: 'browser', title: 'Browser' }, firstChatTab, secondChatTab],
    activeEditorTabId: firstChatTab.id,
    activePairedEditorSubtab: 'local',
  };

  activateEditorTab({
    tabId: secondChatTab.id,
    state: runtimeState,
    setState: (nextState) => {
      runtimeState = nextState;
    },
    getPairedChatEditorTab: () => secondChatTab,
    persistActiveLocalChatSelection() {},
    syncSelectionWithActiveEditorTab() {},
    render() {},
    renderEditorArea() {},
    loadChatHistoryIntoTab: async (tab, forceReload = false) => {
      loadCalls.push({ tabId: tab.id, forceReload });
    },
    loadPromptIntoTab: async () => {},
    savePromptTab() {},
  });

  assert.equal(runtimeState.activeEditorTabId, secondChatTab.id);
  assert.deepEqual(loadCalls, []);
}

{
  const staleChatTab = createChatTab();
  staleChatTab.isHistoryStale = true;
  staleChatTab.pendingHistoryRevisionKey = 'rev-2';
  const loadCalls = [];
  let runtimeState = {
    editorTabs: [{ id: 'browser', kind: 'browser', title: 'Browser' }, staleChatTab],
    activeEditorTabId: 'browser',
    activePairedEditorSubtab: 'browser',
  };

  activateEditorTab({
    tabId: staleChatTab.id,
    state: runtimeState,
    setState: (nextState) => {
      runtimeState = nextState;
    },
    getPairedChatEditorTab: () => staleChatTab,
    persistActiveLocalChatSelection() {},
    syncSelectionWithActiveEditorTab() {},
    render() {},
    renderEditorArea() {},
    loadChatHistoryIntoTab: async (tab, forceReload = false) => {
      loadCalls.push({ tabId: tab.id, forceReload });
    },
    loadPromptIntoTab: async () => {},
    savePromptTab() {},
  });

  assert.equal(runtimeState.activeEditorTabId, staleChatTab.id);
  assert.deepEqual(loadCalls, [{ tabId: staleChatTab.id, forceReload: false }]);
}

{
  const pairedTab = createChatTab();
  const loadCalls = [];
  let runtimeState = {
    editorTabs: [{ id: 'browser', kind: 'browser', title: 'Browser' }, pairedTab],
    activeEditorTabId: 'browser',
    activePairedEditorSubtab: 'browser',
  };

  activatePairedEditorView({
    nextView: 'local',
    state: runtimeState,
    setState: (nextState) => {
      runtimeState = nextState;
    },
    getPairedChatEditorTab: () => pairedTab,
    persistActiveLocalChatSelection() {},
    syncSelectionWithActiveEditorTab() {},
    render() {},
    renderEditorArea() {},
    loadChatHistoryIntoTab: async (tab, forceReload = false) => {
      loadCalls.push({ tabId: tab.id, forceReload });
    },
    loadPromptIntoTab: async () => {},
    savePromptTab() {},
  });

  assert.equal(runtimeState.activePairedEditorSubtab, 'local');
  assert.deepEqual(loadCalls, []);
}

{
  const stalePairedTab = createChatTab();
  stalePairedTab.isHistoryStale = true;
  stalePairedTab.pendingHistoryRevisionKey = 'rev-2';
  const loadCalls = [];
  let runtimeState = {
    editorTabs: [{ id: 'browser', kind: 'browser', title: 'Browser' }, stalePairedTab],
    activeEditorTabId: 'browser',
    activePairedEditorSubtab: 'browser',
  };

  activatePairedEditorView({
    nextView: 'local',
    state: runtimeState,
    setState: (nextState) => {
      runtimeState = nextState;
    },
    getPairedChatEditorTab: () => stalePairedTab,
    persistActiveLocalChatSelection() {},
    syncSelectionWithActiveEditorTab() {},
    render() {},
    renderEditorArea() {},
    loadChatHistoryIntoTab: async (tab, forceReload = false) => {
      loadCalls.push({ tabId: tab.id, forceReload });
    },
    loadPromptIntoTab: async () => {},
    savePromptTab() {},
  });

  assert.equal(runtimeState.activePairedEditorSubtab, 'local');
  assert.deepEqual(loadCalls, [{ tabId: stalePairedTab.id, forceReload: false }]);
}

console.log('renderer-editor-runtime-test: ok');
