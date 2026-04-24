import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererStore } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'store.js'));
const { createSidebarRegionRuntime } = require(path.join(rootDir, 'dist', 'renderer', 'sidebar', 'region-runtime.js'));

function createStorage() {
  const values = new Map();
  return {
    values,
    storage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); },
    },
  };
}

function createClassList() {
  const classes = new Set();
  return {
    add(value) { classes.add(value); },
    remove(value) { classes.delete(value); },
    toggle(value, force) {
      if (force === undefined) {
        if (classes.has(value)) { classes.delete(value); return false; }
        classes.add(value); return true;
      }
      if (force) { classes.add(value); return true; }
      classes.delete(value); return false;
    },
    contains(value) { return classes.has(value); },
  };
}

const { storage, values } = createStorage();
const store = createRendererStore({ storage });
const sidebarContentElement = { clientHeight: 520, classList: createClassList() };
const sidebarElement = { clientHeight: 640 };
const newFilesPanelResizerElement = { classList: createClassList() };
const sidebarActivityButtons = [
  { dataset: { sidebarTab: 'explorer' }, classList: createClassList() },
  { dataset: { sidebarTab: 'files' }, classList: createClassList() },
  { dataset: { sidebarTab: 'prompts' }, classList: createClassList() },
];
const sidebarActivityElement = { querySelectorAll() { return sidebarActivityButtons; } };
const sidebarPanelExplorerElement = { classList: createClassList() };
const sidebarPanelFilesElement = { classList: createClassList() };
const sidebarPanelPromptsElement = { classList: createClassList() };
const sidebarDetailsElement = { innerHTML: '' };

const regionRuntime = createSidebarRegionRuntime({
  workspaceState: store.workspace,
  storage,
  storageKeys: {
    projectTreeExpanded: 'workspace.expanded',
    sidebarSelection: 'workspace.selection',
    sidebarWidth: 'workspace.sidebar-width',
    sidebarDetailsHeight: 'workspace.details-height',
    newFilesHeight: 'workspace.new-files-height',
    newFilesCollapsed: 'workspace.new-files-collapsed',
  },
  elements: {
    documentElement: { style: { values: new Map(), setProperty(name, value) { this.values.set(name, String(value)); } } },
    appShellElement: null,
    sidebarElement,
    sidebarContentElement,
    sidebarActivityElement,
    sidebarPanelExplorerElement,
    sidebarPanelFilesElement,
    sidebarPanelPromptsElement,
    sidebarDetailsElement,
    sidebarResizerElement: null,
    sidebarDetailsResizerElement: null,
    newFilesPanelElement: null,
    newFilesPanelResizerElement,
    dragShieldElement: null,
  },
  layout: { minSidebarWidth: 240, maxSidebarWidth: 560, minSidebarDetailsHeight: 140, minNewFilesPanelHeight: 120, startDrag() {} },
  helpers: {
    loadInitialNewFilesHeight: () => null,
    findSidebarProject(state, projectId) { return [...state.persistentProjects, ...state.temporaryProjects].find((project) => project.projectId === projectId) ?? null; },
    findSidebarChat(state, projectId, chatId) { return [...state.persistentProjects, ...state.temporaryProjects].find((project) => project.projectId === projectId)?.chats.find((chat) => chat.chatId === chatId) ?? null; },
    findKnownProjectUrl(project) { return project.projectUrl ?? null; },
    normalizeStoredUrl(value) { return value ?? null; },
    escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); },
    formatTimestamp(value) { return value ?? ''; },
    renderChevronIcon() { return '<svg data-icon="chevron"></svg>'; },
    syncSidebarSelection() {},
  },
});

const sharedTreeMarkup = regionRuntime.renderSharedFileTreeItem({ kind: 'file', name: 'A&B', depth: 1, iconMarkup: '<i>f</i>', toggleMode: 'placeholder' });
assert.match(sharedTreeMarkup, /A&amp;B/);
assert.match(sharedTreeMarkup, /file-tree__row/);

regionRuntime.setSelectedSidebarItem({ kind: 'project', projectId: 'project-1' });
assert.deepEqual(store.workspace.selectedSidebarItem, { kind: 'project', projectId: 'project-1' });
assert.equal(values.get('workspace.selection'), JSON.stringify({ kind: 'project', projectId: 'project-1' }));
regionRuntime.setSelectedSidebarItem(null);
assert.equal(store.workspace.selectedSidebarItem, null);
assert.equal(values.has('workspace.selection'), false);

store.workspace.isNewFilesCollapsed = true;
regionRuntime.applySidebarDetailsState(true);
assert.equal(sidebarContentElement.classList.contains('sidebar-content--with-new-files'), true);
assert.equal(sidebarContentElement.classList.contains('sidebar-content--new-files-collapsed'), true);
assert.equal(newFilesPanelResizerElement.classList.contains('new-files-panel-resizer--visible'), true);
assert.equal(values.get('workspace.new-files-collapsed'), 'true');

store.workspace.activeSidebarTabId = 'files';
regionRuntime.applySidebarTabState();
assert.equal(sidebarActivityButtons[1].classList.contains('sidebar-activity__button--active'), true);
assert.equal(sidebarPanelFilesElement.classList.contains('sidebar-panel--active'), true);

const appState = {
  persistentProjects: [{ projectId: 'project-1', projectName: 'Project 1', projectUrl: 'https://example.test/project-1', folderPath: '/repo/project-1', chats: [], files: [], createdAt: '2026-04-23T00:00:00.000Z', updatedAt: '2026-04-23T00:00:00.000Z' }],
  temporaryProjects: [],
  lastContext: { currentProjectId: 'project-1', currentLocalFolder: null, currentPromptId: null },
};
regionRuntime.ensureExpandedProjects(appState);
assert.deepEqual([...store.workspace.expandedProjectIds], ['project-1']);
assert.equal(values.get('workspace.expanded'), JSON.stringify(['project-1']));

store.workspace.selectedSidebarItem = { kind: 'project', projectId: 'project-1' };
regionRuntime.renderSidebarDetails(appState);
assert.match(sidebarDetailsElement.innerHTML, /Project details/);
assert.match(sidebarDetailsElement.innerHTML, /Project 1/);

console.log('renderer-sidebar-region-runtime-test: ok');
