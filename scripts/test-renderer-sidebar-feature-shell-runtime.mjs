import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const {
  createRendererSidebarFeatureOptions,
} = require(path.join(rootDir, 'dist', 'renderer', 'sidebar', 'shell-runtime.js'));

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
store.workspace.selectedSidebarItem = { kind: 'project', projectId: 'project-1' };
store.remoteFiles.remoteFilesNotice = { message: 'updated', tone: 'info' };
store.remoteFiles.downloadAutomatically = true;
store.remoteFiles.lastNewFilesSignature = 'before';
store.menus.activeTreeMenu = { kind: 'project', projectId: 'project-1' };

let selectedSidebarItem = null;
const options = createRendererSidebarFeatureOptions({
  appState: store.app,
  workspaceState: store.workspace,
  remoteFilesState: store.remoteFiles,
  storage,
  storageKeys: {
    sidebarSelection: 'renderer.sidebar-selection',
    newFilesCollapsed: 'renderer.new-files-collapsed',
  },
  elements: {
    projectListElement: null,
    newFilesPanelElement: null,
    newFilesPanelResizerElement: null,
  },
  sidebarHost: {
    getTreeMenuKey(state) { return state?.projectId ?? ''; },
    getActiveSidebarTabId() { return store.workspace.activeSidebarTabId; },
    getActiveTreeMenu() { return store.menus.activeTreeMenu; },
    setSelectedSidebarItem(selection) { selectedSidebarItem = selection; },
    ensureExpandedProjects() {},
    ensureNewFilesPanelHeight() {},
    applySidebarDetailsState() {},
    applySidebarTabState() {},
  },
  remoteFilesRuntime: {
    getEffectiveDownloadPath() { return '/tmp/download'; },
    ensureArchiveEntriesForVisibleNewFiles() {},
  },
  queries: {
    getAllSidebarProjects() { return []; },
    getLatestNewFiles() { return []; },
    findPersistentSidebarProject() { return null; },
    findSidebarProject() { return null; },
    findSidebarChat() { return null; },
    getChatFileKey(file) { return `${file.chatId}:${file.messageId}:${file.sandboxPath}`; },
    getSandboxFileBaseName(file) { return file.sandboxPath.split('/').pop() ?? file.sandboxPath; },
  },
  formatters: {
    escapeHtml(value) { return String(value ?? ''); },
    formatTimestamp(value) { return value ?? ''; },
  },
  icons: {
    renderChevronIcon() { return '<svg data-icon="chevron"></svg>'; },
    renderProjectIcon() { return '<svg data-icon="project"></svg>'; },
    renderChatIcon() { return '<svg data-icon="chat"></svg>'; },
    renderMoreActionsIcon() { return '<svg data-icon="more"></svg>'; },
    renderOpenInBrowserIcon() { return '<svg data-icon="browser"></svg>'; },
    renderFolderTreeIcon() { return '<svg data-icon="folder"></svg>'; },
    renderFileTreeFileIcon() { return '<svg data-icon="file"></svg>'; },
    renderArchiveIcon() { return '<svg data-icon="archive"></svg>'; },
    renderApplyIcon() { return '<svg data-icon="apply"></svg>'; },
    renderBusyIcon() { return '<svg data-icon="busy"></svg>'; },
    renderCheckIcon() { return '<svg data-icon="check"></svg>'; },
    renderDownloadArrowIcon() { return '<svg data-icon="download"></svg>'; },
  },
});

assert.equal(options.getSelectedSidebarItem(), store.workspace.selectedSidebarItem);
assert.equal(options.getRemoteFilesNotice(), store.remoteFiles.remoteFilesNotice);
assert.equal(options.getDownloadAutomatically(), true);
assert.equal(options.getActiveSidebarTabId(), store.workspace.activeSidebarTabId);
assert.equal(options.getActiveTreeMenu(), store.menus.activeTreeMenu);

options.setLastNewFilesSignature('after');
assert.equal(store.remoteFiles.lastNewFilesSignature, 'after');

options.setIsNewFilesCollapsed(true);
assert.equal(options.getIsNewFilesCollapsed(), true);

options.setSelectedSidebarItem({ kind: 'chat', projectId: 'project-1', chatId: 'chat-1' });
assert.deepEqual(selectedSidebarItem, { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' });

options.persistSidebarSelection({ kind: 'project', projectId: 'project-9' });
assert.equal(values.get('renderer.sidebar-selection'), JSON.stringify({ kind: 'project', projectId: 'project-9' }));

options.persistSidebarSelection(null);
assert.equal(values.has('renderer.sidebar-selection'), false);

options.persistCollapsedState(true);
assert.equal(values.get('renderer.new-files-collapsed'), 'true');

assert.equal(options.getEffectiveDownloadPath({ projectId: 'project-1', chatId: 'chat-1', messageId: 'message-1', sandboxPath: '/sandbox/file.txt' }), '/tmp/download');

console.log('renderer-sidebar-feature-shell-runtime-test: ok');
