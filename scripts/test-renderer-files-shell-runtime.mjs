import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const {
  createRendererFilesFeatureOptions,
} = require(path.join(rootDir, 'dist', 'renderer', 'files', 'shell-runtime.js'));

const storage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

const store = createRendererStore({ storage });
store.workspace.selectedSidebarItem = { kind: 'project', projectId: 'project-1' };
store.files.projectFileSignatures.set('project-1', 'sig-1');
store.files.localFileEntriesByKey.set('project-1::', [{
  projectId: 'project-1',
  relativePath: 'src/index.ts',
  fullPath: '/repo/src/index.ts',
  fileName: 'index.ts',
  isDirectory: false,
  sizeBytes: 10,
  modifiedAt: '2026-04-23T00:00:00.000Z',
  containsRecentModifiedFiles: false,
}]);

const options = createRendererFilesFeatureOptions({
  appState: store.app,
  workspaceState: store.workspace,
  filesState: store.files,
  remoteFilesState: store.remoteFiles,
  desktopApi: {
    async listProjectFiles() {
      return [];
    },
  },
  elements: {
    fileViewPanelElement: null,
  },
  sidebarHost: {
    renderSharedFileTreeItem() { return '<div>item</div>'; },
    renderSharedFileTreeActionButton() { return '<button>action</button>'; },
    getLocalFileTreeKey(projectId, relativePath = '') { return `${projectId}::${relativePath}`; },
    getLocalFileTreeDepth(relativePath) { return relativePath ? relativePath.split('/').filter(Boolean).length : 0; },
    getLocalFileTreeChildren(projectId, relativePath = '') {
      return store.files.localFileEntriesByKey.get(`${projectId}::${relativePath}`) ?? [];
    },
  },
  queries: {
    getAllSidebarProjects() { return []; },
    findPersistentSidebarProject() { return null; },
    findSidebarProject() { return null; },
  },
  formatters: {
    escapeHtml(value) { return String(value ?? ''); },
    formatTimestamp(value) { return value ?? ''; },
    formatFileSize(value) { return String(value ?? ''); },
  },
  icons: {
    renderArchiveIcon() { return '<svg data-icon="archive"></svg>'; },
    renderSpinnerIcon() { return '<svg data-icon="spinner"></svg>'; },
    renderOpenFolderIcon() { return '<svg data-icon="open-folder"></svg>'; },
    renderRefreshIcon() { return '<svg data-icon="refresh"></svg>'; },
    renderFolderTreeIcon() { return '<svg data-icon="folder"></svg>'; },
    renderFileTreeFileIcon() { return '<svg data-icon="file"></svg>'; },
  },
  classifyActivity() { return 'new'; },
});

assert.equal(options.getSelectedSidebarItem(), store.workspace.selectedSidebarItem);
assert.equal(options.projectFileSignatures.get('project-1'), 'sig-1');
assert.equal(options.getLocalFileTreeKey('project-1', 'src'), 'project-1::src');
assert.equal(options.getLocalFileTreeDepth('src/components'), 2);
assert.equal(options.getLocalFileTreeChildren('project-1', '').length, 1);
assert.equal(options.renderSharedFileTreeItem({ id: 'row-1', label: 'Row 1', kind: 'directory', depth: 0, isExpanded: false }), '<div>item</div>');

console.log('renderer-files-shell-runtime-test: ok');
