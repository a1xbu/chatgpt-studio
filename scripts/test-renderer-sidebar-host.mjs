import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const { createRendererSidebarHost } = require(path.join(rootDir, 'dist', 'renderer', 'sidebar', 'host.js'));

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
store.workspace.expandedProjectIds.add('project-1');
store.menus.activeTreeMenu = { kind: 'project', projectId: 'project-1' };

let pendingTimer = null;
let clearedTimerId = null;
let renderCount = 0;

const host = createRendererSidebarHost({
  sidebarUiRuntime: {
    workspaceState: store.workspace,
    filesState: store.files,
    storage,
    storageKeys: {
      projectTreeExpanded: 'renderer.project-tree-expanded',
      sidebarSelection: 'renderer.sidebar-selection',
      sidebarActiveTab: 'renderer.sidebar-active-tab',
      sidebarWidth: 'renderer.sidebar-width',
      sidebarDetailsHeight: 'renderer.sidebar-details-height',
      newFilesHeight: 'renderer.new-files-height',
      newFilesCollapsed: 'renderer.new-files-collapsed',
    },
    elements: {
      documentElement: { style: { setProperty() {} } },
      appShellElement: null,
      sidebarElement: null,
      sidebarContentElement: null,
      sidebarActivityElement: null,
      sidebarPanelExplorerElement: null,
      sidebarPanelFilesElement: null,
      sidebarPanelPromptsElement: null,
      sidebarDetailsElement: null,
      sidebarResizerElement: null,
      sidebarDetailsResizerElement: null,
      newFilesPanelElement: null,
      newFilesPanelResizerElement: null,
      dragShieldElement: null,
    },
    layout: {
      minSidebarWidth: 240,
      maxSidebarWidth: 720,
      minSidebarDetailsHeight: 120,
      minNewFilesPanelHeight: 160,
      startDrag() {},
    },
    helpers: {
      loadInitialNewFilesHeight() { return null; },
      findSidebarProject() { return null; },
      findSidebarChat() { return null; },
      findKnownProjectUrl() { return null; },
      normalizeStoredUrl(value) { return value ?? null; },
      escapeHtml(value) { return String(value ?? ''); },
      formatTimestamp(value) { return value ?? ''; },
      renderChevronIcon() { return '<svg data-icon="chevron"></svg>'; },
      syncSidebarSelection() {},
    },
  },
  getContext: () => ({
    services: {
      timers: {
        setTimeout(callback, delayMs) {
          pendingTimer = { callback, delayMs };
          return 17;
        },
        clearTimeout(timerId) {
          clearedTimerId = timerId;
        },
      },
    },
    state: {
      treeMenu: {
        getActiveMenu: () => store.menus.activeTreeMenu,
        setActiveMenu: (value) => {
          store.menus.activeTreeMenu = value;
        },
        getCloseTimer: () => store.menus.activeTreeMenuCloseTimer,
        setCloseTimer: (value) => {
          store.menus.activeTreeMenuCloseTimer = value;
        },
      },
    },
    renderHooks: {
      render() {
        renderCount += 1;
      },
    },
  }),
});

host.setSelectedSidebarItem({ kind: 'project', projectId: 'project-1' });
assert.deepEqual(store.workspace.selectedSidebarItem, { kind: 'project', projectId: 'project-1' });
assert.equal(values.get('renderer.sidebar-selection'), JSON.stringify({ kind: 'project', projectId: 'project-1' }));

host.persistExpandedProjectIds();
assert.equal(values.get('renderer.project-tree-expanded'), JSON.stringify(['project-1']));
assert.equal(host.getLocalFileTreeKey('project-1', 'src'), 'project-1::src');
assert.match(host.renderSharedFileTreeActionButton({ label: 'Open', title: 'Open', action: 'open' }), /button/);

assert.equal(host.getActiveSidebarTabId(), 'explorer');
host.setActiveSidebarTabId('files');
assert.equal(store.workspace.activeSidebarTabId, 'files');
host.persistActiveSidebarTabId('prompts');
assert.equal(values.get('renderer.sidebar-active-tab'), 'prompts');

assert.equal(host.getActiveTreeMenu()?.projectId, 'project-1');
host.setActiveTreeMenu({ kind: 'project', projectId: 'project-3' });
assert.equal(host.getActiveTreeMenu()?.projectId, 'project-3');
assert.equal(host.isActiveTreeMenuOpen(), true);

const bootstrapSlice = host.createBootstrapSlice();
assert.equal(bootstrapSlice.uiState.applySidebarWidth, host.applySidebarWidth);
assert.equal(bootstrapSlice.uiState.installNewFilesPanelResizer, host.installNewFilesPanelResizer);

const bindingsSlice = host.createBindingsSlice();
bindingsSlice.state.setActiveSidebarTabId('explorer');
assert.equal(bindingsSlice.state.getActiveSidebarTabId(), 'explorer');
bindingsSlice.actions.persistActiveSidebarTabId('files');
assert.equal(values.get('renderer.sidebar-active-tab'), 'files');
bindingsSlice.state.setActiveTreeMenu({ kind: 'project', projectId: 'project-4' });
assert.equal(bindingsSlice.state.isActiveTreeMenuOpen(), true);
bindingsSlice.state.closeActiveTreeMenu();
assert.equal(store.menus.activeTreeMenu, null);
assert.equal(renderCount, 1);

store.menus.activeTreeMenu = { kind: 'project', projectId: 'project-5' };
host.scheduleActiveTreeMenuClose(25);
assert.equal(store.menus.activeTreeMenuCloseTimer, 17);
assert.equal(pendingTimer?.delayMs, 25);

host.clearActiveTreeMenuCloseTimer();
assert.equal(clearedTimerId, 17);
assert.equal(store.menus.activeTreeMenuCloseTimer, null);

store.menus.activeTreeMenu = { kind: 'project', projectId: 'project-2' };
host.scheduleActiveTreeMenuClose();
pendingTimer.callback();
assert.equal(store.menus.activeTreeMenu, null);
assert.equal(store.menus.activeTreeMenuCloseTimer, null);
assert.equal(renderCount, 2);

console.log('renderer-sidebar-host-test: ok');
