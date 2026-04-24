import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { bindRendererRuntimeSubscriptions } = require(path.join(rootDir, 'dist', 'renderer', 'runtime', 'subscriptions.js'));

const previousWindow = global.window;
const windowListeners = new Map();
global.window = {
  addEventListener(type, listener) {
    windowListeners.set(type, listener);
  },
};

function createBrowserElement() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) {
        if (typeof listener === 'function') {
          listener(event);
        } else if (listener && typeof listener.handleEvent === 'function') {
          listener.handleEvent(event);
        }
      }
    },
  };
}

const desktopListeners = {
  stateChanged: null,
  debugEntry: null,
  chatHistoryUpdated: null,
  terminalData: null,
  terminalExit: null,
};

const desktopPoc = {
  onStateChanged(listener) {
    desktopListeners.stateChanged = listener;
    return () => {};
  },
  onDebugEntry(listener) {
    desktopListeners.debugEntry = listener;
    return () => {};
  },
  onChatHistoryUpdated(listener) {
    desktopListeners.chatHistoryUpdated = listener;
    return () => {};
  },
  onTerminalData(listener) {
    desktopListeners.terminalData = listener;
    return () => {};
  },
  onTerminalExit(listener) {
    desktopListeners.terminalExit = listener;
    return () => {};
  },
};

const browserElement = createBrowserElement();
const calls = {
  stateChanged: [],
  debugEntries: [],
  chatHistoryUpdated: [],
  terminalData: [],
  terminalExit: [],
  browserStarted: 0,
  browserFinished: 0,
  browserStopped: [],
  browserFailed: [],
  browserNavigated: [],
  browserDomReady: 0,
  browserSandboxStatuses: [],
  addDebugLog: [],
  resize: 0,
};

bindRendererRuntimeSubscriptions({
  desktopPoc,
  browserElement,
  handleDesktopStateChanged: (state) => {
    calls.stateChanged.push(state);
  },
  handleDebugEntry: (entry) => {
    calls.debugEntries.push(entry);
  },
  handleChatHistoryUpdated: (payload) => {
    calls.chatHistoryUpdated.push(payload);
  },
  handleBrowserDidStartLoading: () => {
    calls.browserStarted += 1;
  },
  handleBrowserDidFinishLoad: () => {
    calls.browserFinished += 1;
  },
  handleBrowserDidStopLoading: (url) => {
    calls.browserStopped.push(url ?? null);
  },
  handleBrowserDidFailLoad: (payload) => {
    calls.browserFailed.push(payload);
  },
  handleBrowserDidNavigate: (url) => {
    calls.browserNavigated.push(url ?? null);
  },
  handleBrowserDomReady: () => {
    calls.browserDomReady += 1;
  },
  handleBrowserSandboxFileStatus: (payload) => {
    calls.browserSandboxStatuses.push(payload);
  },
  handleTerminalData: (payload) => {
    calls.terminalData.push(payload);
  },
  handleTerminalExit: (payload) => {
    calls.terminalExit.push(payload);
  },
  addDebugLog: (source, level, message, details = null) => {
    calls.addDebugLog.push({ source, level, message, details });
  },
  handleResize: () => {
    calls.resize += 1;
  },
});

assert.equal(typeof windowListeners.get('resize'), 'function');
assert.equal(typeof desktopListeners.stateChanged, 'function');
assert.equal(typeof desktopListeners.debugEntry, 'function');
assert.equal(typeof desktopListeners.chatHistoryUpdated, 'function');
assert.equal(typeof desktopListeners.terminalData, 'function');
assert.equal(typeof desktopListeners.terminalExit, 'function');

browserElement.dispatch('did-start-loading');
browserElement.dispatch('did-finish-load');
browserElement.dispatch('did-stop-loading', { validatedURL: 'https://chatgpt.com/c/1' });
browserElement.dispatch('did-fail-load', { errorCode: -3, errorDescription: 'aborted', validatedURL: 'https://chatgpt.com/c/2' });
browserElement.dispatch('did-navigate', { url: 'https://chatgpt.com/c/3' });
browserElement.dispatch('did-navigate-in-page', { url: 'https://chatgpt.com/c/4' });
browserElement.dispatch('dom-ready');
browserElement.dispatch('ipc-message', { channel: 'chatgpt-file:status', args: [{ fileKey: 'download-1' }] });
browserElement.dispatch('ipc-message', { channel: 'ignored', args: [{ fileKey: 'ignored' }] });
browserElement.dispatch('console-message', { level: 2, message: 'hello from webview', sourceId: 'preload.js', line: 41 });

desktopListeners.stateChanged({ projects: [] });
desktopListeners.debugEntry({ source: 'system', level: 'info', message: 'entry', timestamp: '2026-04-23T00:00:00.000Z', details: null });
desktopListeners.chatHistoryUpdated({
  projectId: 'project-1',
  chatId: 'chat-1',
  revisionKey: 'rev-1',
  updatedAt: '2026-04-23T00:00:00.000Z',
  capturedAt: '2026-04-23T00:00:01.000Z',
  messageCount: 4,
  isPartial: false,
});
desktopListeners.terminalData({ sessionId: 'term-1', data: 'hello' });
desktopListeners.terminalExit({ sessionId: 'term-1', exitCode: 0 });
windowListeners.get('resize')();

assert.equal(calls.browserStarted, 1);
assert.equal(calls.browserFinished, 1);
assert.deepEqual(calls.browserStopped, ['https://chatgpt.com/c/1']);
assert.equal(calls.browserFailed.length, 1);
assert.equal(calls.browserFailed[0].validatedURL, 'https://chatgpt.com/c/2');
assert.deepEqual(calls.browserNavigated, ['https://chatgpt.com/c/3', 'https://chatgpt.com/c/4']);
assert.equal(calls.browserDomReady, 1);
assert.deepEqual(calls.browserSandboxStatuses, [{ fileKey: 'download-1' }]);
assert.deepEqual(calls.stateChanged, [{ projects: [] }]);
assert.equal(calls.debugEntries.length, 1);
assert.deepEqual(calls.chatHistoryUpdated, [{
  projectId: 'project-1',
  chatId: 'chat-1',
  revisionKey: 'rev-1',
  updatedAt: '2026-04-23T00:00:00.000Z',
  capturedAt: '2026-04-23T00:00:01.000Z',
  messageCount: 4,
  isPartial: false,
}]);
assert.deepEqual(calls.terminalData, [{ sessionId: 'term-1', data: 'hello' }]);
assert.deepEqual(calls.terminalExit, [{ sessionId: 'term-1', exitCode: 0 }]);
assert.equal(calls.resize, 1);
assert.equal(calls.addDebugLog.length, 1);
assert.deepEqual(calls.addDebugLog[0], {
  source: 'webview',
  level: 'warn',
  message: 'hello from webview',
  details: 'preload.js:41',
});

if (previousWindow === undefined) {
  delete global.window;
} else {
  global.window = previousWindow;
}

console.log('renderer-runtime-subscriptions-test: ok');
