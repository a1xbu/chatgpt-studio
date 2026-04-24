import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const {
  createRendererBottomPanelFeatureBaseOptions,
  createRendererBottomPanelBootstrapSlice,
  createRendererBottomPanelBindingsSlice,
} = require(path.join(rootDir, 'dist', 'renderer', 'bottom-panel', 'shell-runtime.js'));

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
store.bottomPanel.terminalFitScheduled = true;
store.bottomPanel.debugLogs = [{ id: 'log-1', timestamp: '2026-04-23T00:00:00.000Z', source: 'renderer', level: 'info', message: 'Hello', details: null }];
store.bottomPanel.gitPanelProjectId = 'project-seeded';
store.bottomPanel.gitPanelSelectedRefName = 'seed-ref';
store.bottomPanel.selectedGitCommitHash = 'seed-commit';

const options = createRendererBottomPanelFeatureBaseOptions({
  appState: store.app,
  bottomPanelState: store.bottomPanel,
  store,
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
    localStorage: storage,
    debugCollapsedStorageKey: 'renderer.debug-collapsed',
    debugHeightStorageKey: 'renderer.debug-height',
  },
  limits: {
    maxDebugLogs: 250,
    minDebugPanelHeight: 120,
    maxDebugPanelHeight: 640,
  },
  services: {
    timers: {
      requestAnimationFrame(callback) {
        callback(0);
        return 1;
      },
    },
    clipboard: undefined,
    documentLike: { body: {} },
  },
  desktopApi: {
    writeTerminal: async () => {},
    resizeTerminal: async () => {},
    startTerminal: async () => ({ sessionId: 'terminal-1', cwd: null, shell: '/bin/sh' }),
    closeTerminal: async () => {},
    clearDebugLogs: async () => {},
    getGitOverview: async () => ({ projectId: 'project-1', headRefName: 'main', branches: [], commits: [] }),
    getGitCommitDetails: async () => ({ projectId: 'project-1', commitHash: 'abc123', committedAt: '2026-04-23T00:00:00.000Z', message: 'Test', authorName: 'Tester', authorEmail: 'tester@example.com', parents: [], files: [] }),
  },
  layout: {
    startDrag() {},
  },
  formatters: {
    escapeHtml(value) { return String(value ?? ''); },
    formatTimestamp(value) { return value ?? ''; },
  },
  icons: {
    renderChevronIcon() { return '<svg data-icon="chevron"></svg>'; },
    renderFolderTreeIcon() { return '<svg data-icon="folder"></svg>'; },
    renderFileTreeFileIcon() { return '<svg data-icon="file"></svg>'; },
    renderRefreshIcon() { return '<svg data-icon="refresh"></svg>'; },
  },
});

assert.equal(options.collapsedGitCommitDirectoryKeys, store.bottomPanel.collapsedGitCommitDirectoryKeys);
assert.equal(options.maxDebugLogs, 250);
assert.equal(options.getTerminalFitScheduled(), true);
assert.deepEqual(options.getBottomPanelRuntimeState(), {
  isDebugPanelCollapsed: false,
  activeBottomTabId: 'debug',
  terminalSessions: [],
  renderedTerminalSessionId: null,
  renderedTerminalOutputLength: 0,
  nextTerminalOrdinal: 1,
});

options.setDebugLogs([]);
options.setDebugFilterText('error');
options.setDebugRetentionLimit(42);
options.setTerminalFitScheduled(false);
options.setBottomPanelRuntimeState({
  isDebugPanelCollapsed: true,
  activeBottomTabId: 'terminal:1',
  terminalSessions: [],
  renderedTerminalSessionId: 'terminal-1',
  renderedTerminalOutputLength: 12,
  nextTerminalOrdinal: 2,
});
options.setGitRuntimeState({
  activeBottomTabId: 'terminal:1',
  gitPanelProjectId: 'project-1',
  gitPanelSelectedRefName: 'main',
  gitPanelOverview: null,
  gitPanelLoadError: null,
  gitPanelLoadingRequest: 3,
  gitPanelIsLoading: true,
  selectedGitBranchName: 'main',
  selectedGitCommitHash: 'abc123',
  gitCommitDetails: null,
  gitCommitDetailsError: null,
  gitCommitDetailsIsLoading: false,
  gitCommitDetailsLoadingRequest: 1,
});

assert.deepEqual(store.bottomPanel.debugLogs, []);
assert.equal(store.bottomPanel.debugFilterText, 'error');
assert.equal(store.bottomPanel.debugRetentionLimit, 42);
assert.equal(store.bottomPanel.terminalFitScheduled, false);
assert.equal(store.bottomPanel.isDebugPanelCollapsed, true);
assert.equal(store.bottomPanel.activeBottomTabId, 'terminal:1');
assert.equal(store.bottomPanel.gitPanelProjectId, 'project-1');
assert.equal(store.bottomPanel.selectedGitCommitHash, 'abc123');

const actionCalls = {
  applyDebugPanelHeight: [],
  applyDebugPanelState: 0,
  installResizer: 0,
  createTerminalSessionState: [],
  addDebugLog: [],
  pushDebugLog: [],
  handleTerminalData: [],
  handleTerminalExit: [],
  scheduleTerminalFit: 0,
  toggleBottomPanel: 0,
  copyVisibleDebugLogs: 0,
  clearDebugLogs: 0,
  openEmbeddedTerminal: 0,
  closeTerminalSession: [],
  switchBottomTab: [],
  refreshGitPanel: [],
  refreshGitCommitDetails: [],
  renderDebugLogs: 0,
  renderBottomPanel: 0,
  renderGitPanel: 0,
};

function getFeature() {
  return {
    actions: {
      applyDebugPanelHeight(height) {
        actionCalls.applyDebugPanelHeight.push(height);
      },
      applyDebugPanelState() {
        actionCalls.applyDebugPanelState += 1;
      },
      installResizer() {
        actionCalls.installResizer += 1;
      },
      createTerminalSessionState(snapshot) {
        actionCalls.createTerminalSessionState.push(snapshot);
        return { sessionId: `session:${snapshot.id}` };
      },
      addDebugLog(source, level, message, details) {
        actionCalls.addDebugLog.push({ source, level, message, details });
      },
      pushDebugLog(entry) {
        actionCalls.pushDebugLog.push(entry);
      },
      handleTerminalData(payload) {
        actionCalls.handleTerminalData.push(payload);
      },
      handleTerminalExit(payload) {
        actionCalls.handleTerminalExit.push(payload);
      },
      scheduleTerminalFit() {
        actionCalls.scheduleTerminalFit += 1;
      },
      toggleBottomPanel() {
        actionCalls.toggleBottomPanel += 1;
      },
      copyVisibleDebugLogs() {
        actionCalls.copyVisibleDebugLogs += 1;
      },
      clearDebugLogs() {
        actionCalls.clearDebugLogs += 1;
      },
      openEmbeddedTerminal() {
        actionCalls.openEmbeddedTerminal += 1;
      },
      closeTerminalSession(sessionId) {
        actionCalls.closeTerminalSession.push(sessionId);
      },
      switchBottomTab(tabId) {
        actionCalls.switchBottomTab.push(tabId);
      },
      refreshGitPanel(projectId, refName) {
        actionCalls.refreshGitPanel.push({ projectId, refName });
      },
      refreshGitCommitDetails(projectId, commitHash) {
        actionCalls.refreshGitCommitDetails.push({ projectId, commitHash });
      },
    },
    render: {
      debugLogs() {
        actionCalls.renderDebugLogs += 1;
      },
      bottomPanel() {
        actionCalls.renderBottomPanel += 1;
      },
      gitPanel() {
        actionCalls.renderGitPanel += 1;
      },
    },
    selectors: {
      getGitCommitDirectoryKey(commitHash, relativePath) {
        return `${commitHash}:${relativePath}`;
      },
    },
  };
}

const bootstrapSlice = createRendererBottomPanelBootstrapSlice({
  bottomPanelState: store.bottomPanel,
  getFeature,
});

bootstrapSlice.uiState.applyDebugPanelHeight(360);
bootstrapSlice.uiState.applyDebugPanelState();
bootstrapSlice.uiState.installBottomPanelResizer();
bootstrapSlice.state.setDebugLogs([{ id: 'log-2' }]);
bootstrapSlice.state.setTerminalSessions([{ sessionId: 'terminal-2' }]);
bootstrapSlice.state.setDebugRetentionLimit(77);
bootstrapSlice.state.setIsDebugPanelCollapsed(false);
assert.deepEqual(bootstrapSlice.actions.createTerminalSessionState({ id: 'snapshot-1' }), { sessionId: 'session:snapshot-1' });
bootstrapSlice.actions.addDebugLog('renderer', 'warn', 'Bootstrap log', { detail: 1 });
bootstrapSlice.actions.pushDebugLogEntry({ id: 'entry-1' });
bootstrapSlice.actions.handleTerminalData({ sessionId: 'terminal-2', data: 'pwd' });
bootstrapSlice.actions.handleTerminalExit({ sessionId: 'terminal-2', exitCode: 0 });
bootstrapSlice.actions.scheduleTerminalFit();

assert.deepEqual(actionCalls.applyDebugPanelHeight, [360]);
assert.equal(actionCalls.applyDebugPanelState, 1);
assert.equal(actionCalls.installResizer, 1);
assert.deepEqual(store.bottomPanel.debugLogs, [{ id: 'log-2' }]);
assert.deepEqual(store.bottomPanel.terminalSessions, [{ sessionId: 'terminal-2' }]);
assert.equal(store.bottomPanel.debugRetentionLimit, 77);
assert.equal(store.bottomPanel.isDebugPanelCollapsed, false);
assert.deepEqual(actionCalls.createTerminalSessionState, [{ id: 'snapshot-1' }]);
assert.deepEqual(actionCalls.addDebugLog, [{ source: 'renderer', level: 'warn', message: 'Bootstrap log', details: { detail: 1 } }]);
assert.deepEqual(actionCalls.pushDebugLog, [{ id: 'entry-1' }]);
assert.deepEqual(actionCalls.handleTerminalData, [{ sessionId: 'terminal-2', data: 'pwd' }]);
assert.deepEqual(actionCalls.handleTerminalExit, [{ sessionId: 'terminal-2', exitCode: 0 }]);
assert.equal(actionCalls.scheduleTerminalFit, 1);

store.bottomPanel.gitPanelProjectId = 'project-9';
store.bottomPanel.gitPanelSelectedRefName = 'main';
store.bottomPanel.selectedGitCommitHash = 'commit-9';
store.bottomPanel.gitCommitDetails = { commitHash: 'commit-9' };
store.bottomPanel.gitCommitDetailsError = 'old';
store.bottomPanel.gitCommitDetailsIsLoading = false;

const bindingsSlice = createRendererBottomPanelBindingsSlice({
  bottomPanelState: store.bottomPanel,
  getFeature,
});

bindingsSlice.state.toggleBottomPanel();
assert.equal(actionCalls.toggleBottomPanel, 1);
assert.equal(bindingsSlice.state.getGitPanelProjectId(), 'project-9');
assert.equal(bindingsSlice.state.getSelectedGitRefName(), 'main');

bindingsSlice.state.setSelectedGitBranchName('release');
bindingsSlice.state.setSelectedGitCommitHash('commit-10');
bindingsSlice.state.clearGitCommitDetailsState(true);
bindingsSlice.state.setGitPanelLoadError('load failed');
bindingsSlice.state.setDebugFilterText('terminal');
bindingsSlice.state.setDebugRetentionLimit(88);

assert.equal(store.bottomPanel.selectedGitBranchName, 'release');
assert.equal(bindingsSlice.state.getSelectedGitCommitHash(), 'commit-10');
assert.equal(store.bottomPanel.gitCommitDetails, null);
assert.equal(store.bottomPanel.gitCommitDetailsError, null);
assert.equal(store.bottomPanel.gitCommitDetailsIsLoading, true);
assert.equal(store.bottomPanel.gitPanelLoadError, 'load failed');
assert.equal(store.bottomPanel.debugFilterText, 'terminal');
assert.equal(store.bottomPanel.debugRetentionLimit, 88);

bindingsSlice.actions.copyVisibleDebugLogs();
bindingsSlice.actions.clearDebugLogs();
bindingsSlice.actions.openEmbeddedTerminal();
bindingsSlice.actions.closeTerminalSession('terminal-10');
bindingsSlice.actions.switchBottomTab('git');
bindingsSlice.actions.renderDebugLogs();
bindingsSlice.actions.refreshGitPanel('project-10', 'dev');
bindingsSlice.actions.renderBottomPanel();
bindingsSlice.actions.renderGitPanel();
bindingsSlice.actions.refreshGitCommitDetails('project-10', 'commit-10');
assert.equal(bindingsSlice.actions.getGitCommitDirectoryKey('commit-10', 'src'), 'commit-10:src');
bindingsSlice.actions.addDebugLog('renderer', 'info', 'Bindings log', null);

assert.equal(actionCalls.copyVisibleDebugLogs, 1);
assert.equal(actionCalls.clearDebugLogs, 1);
assert.equal(actionCalls.openEmbeddedTerminal, 1);
assert.deepEqual(actionCalls.closeTerminalSession, ['terminal-10']);
assert.deepEqual(actionCalls.switchBottomTab, ['git']);
assert.equal(actionCalls.renderDebugLogs, 1);
assert.deepEqual(actionCalls.refreshGitPanel, [{ projectId: 'project-10', refName: 'dev' }]);
assert.equal(actionCalls.renderBottomPanel, 1);
assert.equal(actionCalls.renderGitPanel, 1);
assert.deepEqual(actionCalls.refreshGitCommitDetails, [{ projectId: 'project-10', commitHash: 'commit-10' }]);
assert.deepEqual(actionCalls.addDebugLog[actionCalls.addDebugLog.length - 1], { source: 'renderer', level: 'info', message: 'Bindings log', details: null });

console.log('renderer-bottom-panel-shell-runtime-test: ok');
