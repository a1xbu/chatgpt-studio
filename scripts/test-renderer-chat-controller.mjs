import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { loadChatHistoryIntoTab } = require(path.join(rootDir, 'dist', 'renderer', 'chat', 'controller.js'));
const { getChatHistoryRevisionKey } = require(path.join(rootDir, 'dist', 'shared', 'chat-history-revision.js'));

function createHistory(updatedAt, text = 'Hello world') {
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

function createTab(history = null) {
  return {
    id: 'chat:project-1:chat-1',
    kind: 'chat',
    projectId: 'project-1',
    chatId: 'chat-1',
    title: 'Chat 1',
    status: history ? 'ready' : 'loading',
    history,
    message: null,
    requestToken: 0,
    inFlightRequest: null,
    reloadAfterLoad: false,
    historyRevisionKey: history ? getChatHistoryRevisionKey(history) : null,
    pendingHistoryRevisionKey: null,
    isHistoryStale: false,
    renderedContent: { nodeName: 'DIV' },
  };
}

{
  let getChatHistoryCalls = 0;
  let renderCalls = 0;
  const history = createHistory('2026-04-23T00:00:00.000Z');
  const tab = createTab(history);

  await loadChatHistoryIntoTab(tab, false, {
    hasProjectFolder: () => true,
    getChatHistory: async () => {
      getChatHistoryCalls += 1;
      return history;
    },
    addDebugLog() {},
    countReasoningBlocks: () => 0,
    renderEditorArea: () => {
      renderCalls += 1;
    },
  });

  assert.equal(getChatHistoryCalls, 0);
  assert.equal(renderCalls, 0);
  assert.equal(tab.historyRevisionKey, getChatHistoryRevisionKey(history));
  assert.equal(tab.isHistoryStale, false);
}

{
  let getChatHistoryCalls = 0;
  const oldHistory = createHistory('2026-04-23T00:00:00.000Z', 'Old content');
  const nextHistory = createHistory('2026-04-23T00:05:00.000Z', 'New content');
  const tab = createTab(oldHistory);
  tab.pendingHistoryRevisionKey = getChatHistoryRevisionKey(nextHistory);
  tab.isHistoryStale = true;

  await loadChatHistoryIntoTab(tab, false, {
    hasProjectFolder: () => true,
    getChatHistory: async () => {
      getChatHistoryCalls += 1;
      return nextHistory;
    },
    addDebugLog() {},
    countReasoningBlocks: () => 0,
    renderEditorArea() {},
  });

  assert.equal(getChatHistoryCalls, 1);
  assert.equal(tab.history?.messages[0]?.text, 'New content');
  assert.equal(tab.historyRevisionKey, getChatHistoryRevisionKey(nextHistory));
  assert.equal(tab.pendingHistoryRevisionKey, null);
  assert.equal(tab.isHistoryStale, false);
  assert.equal(tab.renderedContent, null);
}

{
  const firstHistory = createHistory('2026-04-23T00:10:00.000Z', 'First revision');
  const secondHistory = createHistory('2026-04-23T00:20:00.000Z', 'Second revision');
  const responses = [firstHistory, secondHistory];
  const resolvers = [];
  let getChatHistoryCalls = 0;
  const tab = createTab(createHistory('2026-04-23T00:00:00.000Z', 'Initial revision'));
  tab.pendingHistoryRevisionKey = getChatHistoryRevisionKey(firstHistory);
  tab.isHistoryStale = true;

  const deps = {
    hasProjectFolder: () => true,
    getChatHistory: async () => {
      getChatHistoryCalls += 1;
      return await new Promise((resolve) => {
        resolvers.push(() => resolve(responses.shift() ?? secondHistory));
      });
    },
    addDebugLog() {},
    countReasoningBlocks: () => 0,
    renderEditorArea() {},
  };

  const firstLoad = loadChatHistoryIntoTab(tab, false, deps);
  assert.equal(typeof tab.inFlightRequest?.then, 'function');

  tab.pendingHistoryRevisionKey = getChatHistoryRevisionKey(secondHistory);
  tab.isHistoryStale = true;
  const secondLoad = loadChatHistoryIntoTab(tab, false, deps);
  assert.equal(tab.reloadAfterLoad, true);

  resolvers.shift()?.();
  await firstLoad;
  await secondLoad;
  if (tab.inFlightRequest) {
    resolvers.shift()?.();
    await tab.inFlightRequest;
  }

  assert.equal(getChatHistoryCalls, 2);
  assert.equal(tab.history?.messages[0]?.text, 'Second revision');
  assert.equal(tab.historyRevisionKey, getChatHistoryRevisionKey(secondHistory));
  assert.equal(tab.isHistoryStale, false);
  assert.equal(tab.pendingHistoryRevisionKey, null);
}

console.log('renderer-chat-controller-test: ok');
