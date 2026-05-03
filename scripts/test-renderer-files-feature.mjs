import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createFilesFeature } = require(path.join(rootDir, 'dist', 'renderer', 'files', 'feature.js'));
const { renderLocalFileTreeRows } = require(path.join(rootDir, 'dist', 'renderer', 'tree', 'local-file-tree.js'));
const { getLocalFileTreeKey } = require(path.join(rootDir, 'dist', 'renderer', 'files', 'runtime.js'));

const fileRecord = {
  projectId: 'project-1',
  chatId: 'chat-1',
  messageId: 'message-1',
  sandboxPath: '/sandbox/out.txt',
  fileName: 'out.txt',
  updatedAt: '2026-04-23T00:00:00.000Z',
  downloadPath: '/repo/out.txt',
  appliedAt: null,
};
const state = {
  temporaryProjects: [],
  persistentProjects: [{
    projectId: 'project-1',
    projectName: 'Project One',
    folderPath: '/repo/project-1',
    files: [fileRecord],
    chats: [],
    lastSeenAt: '2026-04-23T00:00:00.000Z',
    status: 'persistent',
    bundle: null,
  }],
  lastContext: null,
};

let currentState = state;
let listCalls = [];
const localFileEntriesByKey = new Map();
const localFileErrorsByKey = new Map();
const localFileLoadingKeys = new Set();
const archiveEntriesByFileKey = new Map([[`${fileRecord.chatId}::${fileRecord.messageId}::${fileRecord.sandboxPath}`, [{ relativePath: 'old.txt' }]]]);
const archiveEntryErrorsByFileKey = new Map([[`${fileRecord.chatId}::${fileRecord.messageId}::${fileRecord.sandboxPath}`, 'old error']]);
const archiveEntryLoadingKeys = new Set([`${fileRecord.chatId}::${fileRecord.messageId}::${fileRecord.sandboxPath}`]);

const feature = createFilesFeature({
  getCurrentState: () => currentState,
  getSelectedSidebarItem: () => ({ kind: 'project', projectId: 'project-1' }),
  getAllSidebarProjects(nextState) { return nextState.persistentProjects; },
  findPersistentSidebarProject(nextState, projectId) {
    return nextState.persistentProjects.find((project) => project.projectId === projectId) ?? null;
  },
  findSidebarProject(nextState, projectId) {
    return nextState.persistentProjects.find((project) => project.projectId === projectId) ?? null;
  },
  projectFileSignatures: new Map([['project-1', 'old-signature']]),
  localFileEntriesByKey,
  localFileErrorsByKey,
  localFileLoadingKeys,
  archiveEntriesByFileKey,
  archiveEntryErrorsByFileKey,
  archiveEntryLoadingKeys,
  projectBundleCreateInFlightIds: new Set(),
  projectBundleErrorsByProjectId: new Map(),
  expandedLocalDirectoryKeys: new Set(),
  fileViewPanelElement: null,
  async listProjectFiles(projectId, relativePath = '') {
    listCalls.push(`${projectId}:${relativePath}`);
    return [{
      projectId,
      relativePath: relativePath ? `${relativePath}/src/index.ts` : 'src/index.ts',
      fullPath: '/repo/project-1/src/index.ts',
      fileName: 'index.ts',
      isDirectory: false,
      sizeBytes: 42,
      modifiedAt: '2026-04-23T00:00:00.000Z',
      containsRecentModifiedFiles: false,
      isGitIgnored: false,
      isGitUntracked: false,
    }];
  },
  getLocalFileTreeKey,
  getLocalFileTreeDepth(relativePath) { return relativePath ? relativePath.split('/').filter(Boolean).length : 0; },
  getLocalFileTreeChildren(projectId, relativePath = '') {
    return localFileEntriesByKey.get(getLocalFileTreeKey(projectId, relativePath)) ?? [];
  },
  classifyActivity() { return 'new'; },
  escapeHtml(value) { return String(value ?? ''); },
  formatTimestamp(value) { return value ?? ''; },
  formatFileSize(value) { return String(value ?? ''); },
  renderArchiveIcon() { return '<svg data-icon="archive"></svg>'; },
  renderSpinnerIcon() { return '<svg data-icon="spinner"></svg>'; },
  renderOpenFolderIcon() { return '<svg data-icon="open-folder"></svg>'; },
  renderRefreshIcon() { return '<svg data-icon="refresh"></svg>'; },
  renderFolderTreeIcon() { return '<svg data-icon="folder"></svg>'; },
  renderFileTreeFileIcon() { return '<svg data-icon="file"></svg>'; },
  renderSharedFileTreeItem(model) { return `<div class="tree-item">${model.title ?? model.name}</div>${model.childrenMarkup ?? ''}`; },
  renderSharedFileTreeActionButton() { return '<button>action</button>'; },
});

feature.actions.syncProjectFileSignatures(state);
assert.equal(localFileEntriesByKey.size, 0);
assert.equal(archiveEntriesByFileKey.size, 0);

await feature.actions.loadLocalFileTree('project-1', '');
assert.deepEqual(listCalls, ['project-1:']);
assert.equal(localFileEntriesByKey.get('project-1::')?.length, 1);

const markup = feature.render.localFileViewPanel(state);
assert.match(markup, /Project One/);
assert.match(markup, /\/repo\/project-1/);
assert.match(markup, /src\/index.ts/);

localFileEntriesByKey.set('project-1::', [{
  projectId: 'project-1',
  relativePath: 'cached.txt',
  fullPath: '/repo/project-1/cached.txt',
  fileName: 'cached.txt',
  isDirectory: false,
  sizeBytes: 5,
  modifiedAt: '2026-04-23T00:00:00.000Z',
  containsRecentModifiedFiles: false,
  isGitIgnored: false,
  isGitUntracked: false,
}]);
archiveEntriesByFileKey.set(`${fileRecord.chatId}::${fileRecord.messageId}::${fileRecord.sandboxPath}`, [{ relativePath: 'bundle.txt' }]);
await feature.actions.refreshLocalProjectTree('project-1');
assert.deepEqual(listCalls, ['project-1:', 'project-1:']);
assert.equal(localFileEntriesByKey.get('project-1::')?.[0].fileName, 'index.ts');
assert.equal(archiveEntriesByFileKey.size, 0);


const untrackedMarkup = renderLocalFileTreeRows({
  projectId: 'project-1',
  entries: [{
    name: 'draft.txt',
    relativePath: 'draft.txt',
    fullPath: '/repo/project-1/draft.txt',
    kind: 'file',
    hasChildren: false,
    modifiedAt: '2026-04-23T00:00:00.000Z',
    createdAt: '2026-04-23T00:00:00.000Z',
    containsRecentModifiedFiles: false,
    isGitIgnored: false,
    isGitUntracked: true,
  }],
  isExpanded() { return false; },
  getDepth() { return 0; },
  classifyActivity() { return 'new'; },
  renderChildren() { return ''; },
}, {
  renderFolderTreeIcon() { return '<svg data-icon="folder"></svg>'; },
  renderFileTreeFileIcon() { return '<svg data-icon="file"></svg>'; },
  renderSharedFileTreeItem(model) {
    return `<div class="${model.rowClassNames.join(' ')}">${model.name}</div>`;
  },
});
assert.match(untrackedMarkup, /file-tree__row--untracked/);

console.log('renderer-files-feature-test: ok');
