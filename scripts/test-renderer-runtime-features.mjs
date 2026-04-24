import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createBrowserFeature } = require(path.join(rootDir, 'dist', 'renderer', 'browser', 'feature.js'));
const { createBottomPanelFeature } = require(path.join(rootDir, 'dist', 'renderer', 'bottom-panel', 'feature.js'));

const noopStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

function createDownloadStatus(status) {
  return {
    projectId: 'project-1',
    chatId: 'chat-1',
    messageId: 'message-1',
    sandboxPath: `${status}.zip`,
    fileName: `${status}.zip`,
    status,
    progressPercent: null,
    message: null,
    downloadPath: null,
    updatedAt: '2026-04-23T00:00:00.000Z',
  };
}

let browserNavigationState = {
  browserCanGoBack: false,
  browserCanGoForward: false,
  browserIsLoading: false,
  pendingBrowserUrl: 'https://chatgpt.com/pending',
};
const browserRefreshCalls = [];
const browserLogs = [];
const fileDownloadStatuses = new Map([
  ['waiting', createDownloadStatus('waiting')],
  ['downloading', createDownloadStatus('downloading')],
  ['downloaded', createDownloadStatus('downloaded')],
]);

const browserFeature = createBrowserFeature({
  storage: noopStorage,
  browserOpenedStorageKey: 'last-browser',
  lastActiveLocalChatStorageKey: 'last-local',
  getCurrentState: () => null,
  getSelectedSidebarItem: () => null,
  setSelectedSidebarItem() {},
  getBrowserOpenedSidebarItem: () => null,
  setBrowserOpenedSidebarItem() {},
  getBrowserNavigationState: () => browserNavigationState,
  setBrowserNavigationState: (nextState) => {
    browserNavigationState = nextState;
  },
  getHasRestoredLastOpenState: () => false,
  setHasRestoredLastOpenState() {},
  getDownloadAutomatically: () => false,
  setActiveEditorTabId() {},
  setActivePairedEditorSubtab() {},
  findSidebarProject: () => null,
  findPersistentSidebarProject: () => null,
  findSidebarChat: () => null,
  getAllSidebarProjects: () => [],
  getLatestNewFiles: () => [],
  getChatFileKey: (file) => `${file.projectId}:${file.chatId}:${file.messageId}:${file.sandboxPath}`,
  browserController: {
    openUrl() {},
    refreshNavigationState(url) {
      browserRefreshCalls.push(url ?? null);
    },
  },
  browserElement: null,
  fileDownloadStatuses,
  ensureChatHistoryTab: async () => null,
  openChatHistoryTab: async () => null,
  activateEditorTab() {},
  render() {},
  renderEditorArea() {},
  reloadChatHistoryIntoTab: async () => {},
  findChatEditorTab: () => null,
  addDebugLog: (source, level, message, details = null) => {
    browserLogs.push({ source, level, message, details });
  },
  resolveChatBrowserUrl: () => 'https://chatgpt.com/c/1',
  resolveProjectBrowserUrl: () => 'https://chatgpt.com',
});

browserFeature.actions.handleWebviewDidStartLoading();
assert.equal(browserNavigationState.browserIsLoading, true);
assert.equal(fileDownloadStatuses.has('waiting'), false);
assert.equal(fileDownloadStatuses.has('downloading'), false);
assert.equal(fileDownloadStatuses.has('downloaded'), true);
assert.deepEqual(browserRefreshCalls, [null]);
assert.equal(browserLogs[0].message, 'Webview started loading ChatGPT.');

browserFeature.actions.handleWebviewDidFailLoad({
  errorCode: 500,
  errorDescription: 'boom',
  validatedURL: 'https://chatgpt.com/c/500',
});
assert.equal(browserNavigationState.browserIsLoading, false);
assert.equal(browserNavigationState.pendingBrowserUrl, null);
assert.deepEqual(browserRefreshCalls, [null, 'https://chatgpt.com/c/500']);
assert.equal(browserLogs.at(-1).level, 'error');
assert.match(browserLogs.at(-1).details, /code=500/);

browserFeature.actions.handleWebviewDomReady();
assert.deepEqual(browserRefreshCalls, [null, 'https://chatgpt.com/c/500', null]);

let bottomPanelRuntimeState = {
  activeBottomTabId: 'term-1',
  terminalSessions: [{
    sessionId: 'term-1',
    cwd: '/repo',
    shell: '/bin/bash',
    title: 'Terminal 1',
    outputBuffer: 'hello',
    exited: false,
  }],
  renderedTerminalSessionId: 'term-1',
  renderedTerminalOutputLength: 5,
  nextTerminalOrdinal: 2,
  isDebugPanelCollapsed: false,
};
let terminalUiState = {
  terminalInstance: {
    clear() {},
    dispose() {},
    focus() {},
    loadAddon() {},
    onData() {},
    open() {},
    reset() {},
    resize() {},
    write(data) {
      terminalWrites.push(data);
    },
    cols: 80,
    rows: 24,
  },
  terminalFitAddon: null,
};
const terminalWrites = [];
const bottomPanelFeature = createBottomPanelFeature({
  collapsedGitCommitDirectoryKeys: new Set(),
  getCurrentState: () => null,
  getBottomPanelRuntimeState: () => bottomPanelRuntimeState,
  setBottomPanelRuntimeState: (nextState) => {
    bottomPanelRuntimeState = nextState;
  },
  getGitRuntimeState: () => ({
    activeBottomTabId: bottomPanelRuntimeState.activeBottomTabId,
    gitPanelProjectId: null,
    gitPanelSelectedRefName: null,
    gitPanelOverview: null,
    gitPanelLoadError: null,
    gitPanelLoadingRequest: 0,
    gitPanelIsLoading: false,
    selectedGitBranchName: null,
    selectedGitCommitHash: null,
    gitCommitDetails: null,
    gitCommitDetailsError: null,
    gitCommitDetailsIsLoading: false,
    gitCommitDetailsLoadingRequest: 0,
  }),
  setGitRuntimeState() {},
  getDebugRuntimeState: () => ({
    debugLogs: [],
    debugFilterText: '',
    debugRetentionLimit: 100,
  }),
  setDebugLogs() {},
  setDebugFilterText() {},
  setDebugRetentionLimit() {},
  maxDebugLogs: 100,
  getTerminalUiState: () => terminalUiState,
  setTerminalUiState: (nextState) => {
    terminalUiState = nextState;
  },
  getTerminalFitScheduled: () => false,
  setTerminalFitScheduled() {},
  getActiveSidebarProject: () => null,
  renderApp() {},
  elements: {
    appShellElement: null,
    workbenchElement: null,
    toggleBottomPanelButton: null,
    bottomPanelResizerElement: null,
    bottomTabsElement: null,
    debugConsoleElement: null,
    debugRetentionElement: null,
    debugViewElement: null,
    terminalViewElement: null,
    gitViewElement: null,
    terminalPaneElement: null,
    terminalEmptyElement: null,
    terminalMetaElement: null,
    terminalHostElement: null,
  },
  storage: {
    localStorage: noopStorage,
    debugCollapsedStorageKey: 'debug-collapsed',
    debugHeightStorageKey: 'debug-height',
  },
  limits: {
    minDebugPanelHeight: 120,
    maxDebugPanelHeight: 480,
  },
  timers: {
    requestAnimationFrame(callback) {
      callback(16);
      return 1;
    },
  },
  clipboard: {
    clipboard: undefined,
    documentLike: {
      documentElement: {
        style: {
          setProperty() {},
        },
      },
    },
  },
  desktopApi: {
    writeTerminal: async () => {},
    resizeTerminal: async () => {},
    startTerminal: async () => ({ sessionId: 'term-2', cwd: '/repo', shell: '/bin/bash' }),
    closeTerminal: async () => {},
    clearDebugLogs: async () => {},
    getGitOverview: async () => ({ branches: [], commits: [], status: null }),
    getGitCommitDetails: async () => ({ commit: null, files: [] }),
  },
  layout: {
    startDrag() {},
  },
  formatters: {
    escapeHtml: (value) => String(value ?? ''),
    formatTimestamp: (value) => String(value ?? ''),
  },
  icons: {
    renderChevronIcon: () => '<chevron />',
    renderFolderTreeIcon: () => '<folder />',
    renderFileTreeFileIcon: () => '<file />',
    renderRefreshIcon: () => '<refresh />',
  },
});

bottomPanelFeature.actions.handleTerminalData({ sessionId: 'term-1', data: ' world' });
assert.equal(bottomPanelRuntimeState.terminalSessions[0].outputBuffer, 'hello world');
assert.deepEqual(terminalWrites, [' world']);
assert.equal(bottomPanelRuntimeState.renderedTerminalOutputLength, 11);

bottomPanelFeature.actions.handleTerminalExit({ sessionId: 'term-1', exitCode: 0 });
assert.equal(bottomPanelRuntimeState.terminalSessions[0].exited, true);
assert.match(bottomPanelRuntimeState.terminalSessions[0].outputBuffer, /process exited with code 0/);
assert.match(terminalWrites.at(-1), /process exited with code 0/);

console.log('renderer-runtime-features-test: ok');
