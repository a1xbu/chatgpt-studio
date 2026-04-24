import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));

const storageValues = new Map([
  ['desktop-poc.project-tree-expanded', JSON.stringify(['project-a', 'project-b'])],
  ['desktop-poc.sidebar-details-collapsed', 'false'],
  ['desktop-poc.sidebar-active-tab', 'prompts'],
  ['desktop-poc.new-files-collapsed', 'true'],
  ['desktop-poc.download-automatically', 'true'],
  ['desktop-poc.sidebar-selection', JSON.stringify({ kind: 'chat', projectId: 'project-a', chatId: 'chat-1' })],
  ['desktop-poc.last-browser-opened', JSON.stringify({ kind: 'project', projectId: 'project-b' })],
]);

const storage = {
  getItem(key) {
    return storageValues.has(key) ? storageValues.get(key) : null;
  },
  setItem(key, value) {
    storageValues.set(key, value);
  },
  removeItem(key) {
    storageValues.delete(key);
  },
};

const store = createRendererStore({ storage });

assert.deepEqual([...store.workspace.expandedProjectIds], ['project-a', 'project-b']);
assert.equal(store.workspace.isSidebarDetailsCollapsed, false);
assert.equal(store.workspace.activeSidebarTabId, 'prompts');
assert.equal(store.workspace.isNewFilesCollapsed, true);
assert.equal(store.remoteFiles.downloadAutomatically, true);
assert.deepEqual(store.workspace.selectedSidebarItem, { kind: 'chat', projectId: 'project-a', chatId: 'chat-1' });
assert.deepEqual(store.browser.browserOpenedSidebarItem, { kind: 'project', projectId: 'project-b' });
assert.equal(store.editor.activeEditorTabId, 'browser');
assert.equal(store.bottomPanel.activeBottomTabId, 'debug');

store.setBrowserNavigationState({
  browserCanGoBack: true,
  browserCanGoForward: false,
  browserIsLoading: true,
  pendingBrowserUrl: 'https://chatgpt.com',
});
assert.deepEqual(store.getBrowserNavigationState(), {
  browserCanGoBack: true,
  browserCanGoForward: false,
  browserIsLoading: true,
  pendingBrowserUrl: 'https://chatgpt.com',
});

store.setEditorRuntimeState({
  editorTabs: [{ id: 'browser', kind: 'browser', title: 'Browser' }, { id: 'prompt:1', kind: 'prompt', promptId: '1', title: 'Prompt', status: 'loading', isDirty: false }],
  activeEditorTabId: 'prompt:1',
  activePairedEditorSubtab: 'local',
});
assert.equal(store.getEditorRuntimeState().activeEditorTabId, 'prompt:1');
assert.equal(store.editor.activePairedEditorSubtab, 'local');

store.setPromptMenuRuntimeState({
  activePromptMenu: { promptId: 'prompt-1' },
  activePromptMenuCloseTimer: 12,
});
assert.deepEqual(store.getPromptMenuRuntimeState(), {
  activePromptMenu: { promptId: 'prompt-1' },
  activePromptMenuCloseTimer: 12,
});

store.setBottomPanelRuntimeState({
  activeBottomTabId: 'terminal:1',
  terminalSessions: [{ id: 'terminal:1', title: 'Terminal 1', cwd: '/tmp', cols: 120, rows: 40, status: 'open' }],
  renderedTerminalSessionId: 'terminal:1',
  renderedTerminalOutputLength: 42,
  nextTerminalOrdinal: 2,
  isDebugPanelCollapsed: true,
});
assert.equal(store.bottomPanel.activeBottomTabId, 'terminal:1');
assert.equal(store.getBottomPanelRuntimeState().renderedTerminalOutputLength, 42);

store.setGitRuntimeState({
  activeBottomTabId: 'git',
  gitPanelProjectId: 'project-a',
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
  gitCommitDetailsLoadingRequest: 4,
});
assert.equal(store.getGitRuntimeState().gitPanelProjectId, 'project-a');
assert.equal(store.bottomPanel.selectedGitCommitHash, 'abc123');

const terminalUi = { terminalInstance: { fake: true }, terminalFitAddon: { fake: true } };
store.setTerminalUiState(terminalUi);
assert.deepEqual(store.getTerminalUiState(), terminalUi);

console.log('renderer-store-test: ok');
