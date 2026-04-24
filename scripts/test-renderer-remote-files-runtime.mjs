import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const { createRendererRemoteFilesRuntime } = require(path.join(rootDir, 'dist', 'renderer', 'remote-files', 'runtime.js'));

function createStorage() {
  const values = new Map();
  return { values, storage: { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); } } };
}

const { storage } = createStorage();
const store = createRendererStore({ storage });
let renderCalls = 0;
let refreshProjectId = null;
let pendingTimer = null;
const remoteRuntime = createRendererRemoteFilesRuntime({
  appState: store.app,
  workspaceState: store.workspace,
  filesState: store.files,
  remoteFilesState: store.remoteFiles,
  getAllSidebarProjects() { return []; },
  getAllProjectsForRefresh() { return []; },
  render() { renderCalls += 1; },
  desktopApi: {
    async listSandboxFileArchiveEntries() { return []; },
    async applySandboxFile(projectId, chatId, messageId, sandboxPath, relativePath = null) {
      return { file: { projectId, chatId, messageId, sandboxPath, fileName: 'notes.txt', projectName: 'Project 1', downloadUrl: null, downloadPath: relativePath, updatedAt: '2026-04-23T00:00:00.000Z' }, updatedFileCount: 2 };
    },
  },
  timers: { setTimeout(callback) { pendingTimer = callback; return 1; }, clearTimeout() {} },
  refreshLocalProjectTree(projectId) { refreshProjectId = projectId; },
});

await remoteRuntime.runApplySandboxFile({ projectId: 'project-1', chatId: 'chat-1', messageId: 'message-1', sandboxPath: 'notes.txt', fileName: 'notes.txt', projectName: 'Project 1', downloadUrl: null, downloadPath: null, updatedAt: '2026-04-23T00:00:00.000Z' });
assert.equal(refreshProjectId, 'project-1');
assert.equal(renderCalls > 0, true);
assert.equal(store.remoteFiles.remoteFilesNotice?.message, 'Updated 2 files.');
assert.equal(store.remoteFiles.remoteFilesNotice?.tone, 'success');
assert.equal(typeof pendingTimer, 'function');
pendingTimer();
assert.equal(store.remoteFiles.remoteFilesNotice, null);

console.log('renderer-remote-files-runtime-test: ok');
