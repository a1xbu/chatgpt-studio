import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const {
  createRendererRemoteFilesBindingsSlice,
} = require(path.join(rootDir, 'dist', 'renderer', 'remote-files', 'shell-runtime.js'));

function createStorage() {
  const values = new Map();
  return {
    values,
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

const { storage, values } = createStorage();
const store = createRendererStore({ storage });

const remoteFile = {
  projectId: 'project-1',
  chatId: 'chat-1',
  messageId: 'message-1',
  sandboxPath: '/sandbox/file.txt',
  fileName: 'file.txt',
};
const latestEntry = { project: { id: 'project-1' }, file: remoteFile };
const remoteRuntimeCalls = {
  notices: 0,
  applyFile: [],
  applyAll: [],
  loadArchiveEntries: [],
};
const bindingsSlice = createRendererRemoteFilesBindingsSlice({
  workspaceState: store.workspace,
  remoteFilesState: store.remoteFiles,
  storage,
  storageKeys: {
    newFilesCollapsed: 'renderer.new-files-collapsed',
    downloadAutomatically: 'renderer.download-automatically',
  },
  remoteFilesRuntime: {
    showRemoteFilesNotice() {
      remoteRuntimeCalls.notices += 1;
    },
    runApplySandboxFile(file) {
      remoteRuntimeCalls.applyFile.push(file);
    },
    runApplyAllNewFiles(entries) {
      remoteRuntimeCalls.applyAll.push(entries);
    },
    loadArchiveEntriesForFile(file) {
      remoteRuntimeCalls.loadArchiveEntries.push(file);
    },
    getEffectiveDownloadPath() {
      return '/tmp/download';
    },
  },
  getLatestEntries() {
    return [latestEntry];
  },
  findLatestNewFileByKey(fileKey) {
    return fileKey === 'chat-1:message-1:/sandbox/file.txt' ? latestEntry : null;
  },
  getChatFileKey(file) {
    return `${file.chatId}:${file.messageId}:${file.sandboxPath}`;
  },
  shouldWarnBeforeApplyingArchive(file) {
    return file.sandboxPath.endsWith('.zip');
  },
  createIsoTimestamp() {
    return '2026-04-23T12:00:00.000Z';
  },
});

bindingsSlice.state.setDownloadAutomatically(false);
assert.equal(store.remoteFiles.downloadAutomatically, false);

bindingsSlice.actions.showRemoteFilesNotice();
assert.equal(remoteRuntimeCalls.notices, 1);
assert.deepEqual(bindingsSlice.actions.findLatestNewFileByKey('chat-1:message-1:/sandbox/file.txt'), latestEntry);
assert.deepEqual(bindingsSlice.actions.getLatestEntries(), [latestEntry]);
assert.deepEqual(bindingsSlice.actions.findLatestEntryByKey('chat-1:message-1:/sandbox/file.txt'), latestEntry);

bindingsSlice.actions.runApplySandboxFile(remoteFile);
assert.deepEqual(remoteRuntimeCalls.applyFile, [remoteFile]);

store.workspace.isNewFilesCollapsed = false;
bindingsSlice.actions.toggleNewFilesCollapsed();
assert.equal(store.workspace.isNewFilesCollapsed, true);
assert.equal(values.get('renderer.new-files-collapsed'), 'true');

bindingsSlice.actions.runApplyAllNewFiles([latestEntry]);
assert.deepEqual(remoteRuntimeCalls.applyAll, [[latestEntry]]);
assert.equal(bindingsSlice.actions.getRemoteFileRootKey(remoteFile), 'root::chat-1:message-1:/sandbox/file.txt');
assert.equal(bindingsSlice.actions.getRemoteFileArchiveBranchKey(remoteFile, 'src/index.ts'), 'archive::chat-1:message-1:/sandbox/file.txt::src/index.ts');

bindingsSlice.actions.loadArchiveEntriesForFile(remoteFile);
assert.deepEqual(remoteRuntimeCalls.loadArchiveEntries, [remoteFile]);
assert.equal(bindingsSlice.actions.shouldWarnBeforeApplyingArchive(remoteFile), false);

bindingsSlice.actions.persistDownloadAutomatically(true);
assert.equal(values.get('renderer.download-automatically'), 'true');
assert.equal(bindingsSlice.actions.getEffectiveDownloadPath(remoteFile), '/tmp/download');
assert.equal(bindingsSlice.actions.newIsoTimestamp(), '2026-04-23T12:00:00.000Z');

console.log('renderer-remote-files-shell-runtime-test: ok');
