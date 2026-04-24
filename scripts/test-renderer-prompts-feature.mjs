import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createPromptsFeature } = require(path.join(rootDir, 'dist', 'renderer', 'prompts', 'feature.js'));

const previousWindow = global.window;
const previousHtmlInput = global.HTMLInputElement;

global.HTMLInputElement = class HTMLInputElement {
  focus() {
    this.focused = true;
  }

  select() {
    this.selected = true;
  }
};

global.window = {
  requestAnimationFrame(callback) {
    callback(16);
    return 1;
  },
};

function createPrompt(id, title) {
  return {
    id,
    title,
    fileName: `${title}.md`,
    fullPath: `/prompts/${title}.md`,
    updatedAt: '2026-04-23T07:00:00.000Z',
    createdAt: '2026-04-23T06:00:00.000Z',
    sizeBytes: 128,
  };
}

let currentState = null;
let promptDirectoryPath = '';
let prompts = [createPrompt('prompt-1', 'Prompt 1')];
let promptMenuRuntimeState = {
  activePromptMenu: null,
  activePromptMenuCloseTimer: null,
};
let promptNameDialogState = null;
let archiveApplyWarningDialogState = null;
let propertiesDialogState = null;
let renderCalls = 0;
let openedPromptId = null;
let renamedPromptCall = null;
let deletedPromptId = null;
let closedEditorTabId = null;
let latestSnapshot = {
  directoryPath: '/prompts',
  prompts: [...prompts],
};

const promptContentCache = new Map([
  ['obsolete', 'stale'],
  ['prompt-1', 'cached'],
]);

const latestNewFilesByKey = new Map([
  ['project-1:chat-1:msg-1:bundle.zip', {
    file: {
      projectId: 'project-1',
      projectName: 'Project 1',
      chatId: 'chat-1',
      messageId: 'msg-1',
      sandboxPath: 'bundle.zip',
      downloadUrl: null,
      downloadPath: null,
      fileName: 'bundle.zip',
      discoveredAt: '2026-04-23T07:00:00.000Z',
      updatedAt: '2026-04-23T07:00:00.000Z',
      hasRemoteManifest: true,
      remoteManifestProjectId: 'project-1',
      remoteManifestStatus: 'matched',
    },
  }],
  ['project-1:chat-1:msg-2:danger-bundle.zip', {
    file: {
      projectId: 'project-1',
      projectName: 'Project 1',
      chatId: 'chat-1',
      messageId: 'msg-2',
      sandboxPath: 'danger-bundle.zip',
      downloadUrl: null,
      downloadPath: null,
      fileName: 'danger-bundle.zip',
      discoveredAt: '2026-04-23T07:00:00.000Z',
      updatedAt: '2026-04-23T07:00:00.000Z',
      hasRemoteManifest: true,
      remoteManifestProjectId: 'project-2',
      remoteManifestStatus: 'mismatched',
    },
  }],
]);

const fakeInput = new global.HTMLInputElement();
const overlayRootElement = {
  innerHTML: '',
  querySelector(selector) {
    return selector === '[data-role="prompt-name-input"]' ? fakeInput : null;
  },
};

const promptViewPanelElement = {
  querySelectorAll() {
    return [];
  },
};

const bodyElement = {
  children: [],
  append(child) {
    this.children.push(child);
  },
};

const documentLike = {
  body: bodyElement,
  createElement() {
    return {
      id: '',
      className: '',
      innerHTML: '',
      style: {},
      firstElementChild: null,
      addEventListener() {},
      remove() {},
    };
  },
  getElementById() {
    return null;
  },
};

const feature = createPromptsFeature({
  getCurrentState: () => currentState,
  getPromptDirectoryPath: () => promptDirectoryPath,
  setPromptDirectoryPath: (value) => {
    promptDirectoryPath = value;
  },
  getPrompts: () => prompts,
  setPrompts: (value) => {
    prompts = value;
  },
  promptContentCache,
  getPromptMenuRuntimeState: () => promptMenuRuntimeState,
  setPromptMenuRuntimeState: (nextState) => {
    promptMenuRuntimeState = nextState;
  },
  getPromptNameDialogState: () => promptNameDialogState,
  setPromptNameDialogState: (state) => {
    promptNameDialogState = state;
  },
  getArchiveApplyWarningDialogState: () => archiveApplyWarningDialogState,
  setArchiveApplyWarningDialogState: (state) => {
    archiveApplyWarningDialogState = state;
  },
  getPropertiesDialogState: () => propertiesDialogState,
  setPropertiesDialogState: (state) => {
    propertiesDialogState = state;
  },
  listPrompts: async () => latestSnapshot,
  readPrompt: async (promptId) => ({ prompt: createPrompt(promptId, `Read ${promptId}`), content: `Content for ${promptId}` }),
  createPrompt: async (name) => createPrompt('prompt-created', name.replace(/\.md$/i, '')),
  renamePrompt: async (promptId, name) => {
    renamedPromptCall = { promptId, name };
    return createPrompt('prompt-renamed', name.replace(/\.md$/i, ''));
  },
  deletePromptRecord: async (promptId) => {
    deletedPromptId = promptId;
    latestSnapshot = { directoryPath: '/prompts', prompts: [] };
  },
  normalizeEditorTabsState: () => {},
  openPromptTab: async (promptId) => {
    openedPromptId = promptId;
  },
  findPromptEditorTab: (promptId) => promptId === 'prompt-1'
    ? {
        id: 'prompt:prompt-1',
        kind: 'prompt',
        promptId: 'prompt-1',
        title: 'Prompt 1',
        promptPath: '/prompts/Prompt 1.md',
        promptRecord: createPrompt('prompt-1', 'Prompt 1'),
        content: 'Body',
        draftContent: 'Body',
        status: 'ready',
        message: null,
        isDirty: false,
        isEditing: false,
        saveState: 'idle',
        saveMessage: null,
        requestToken: 0,
        inFlightRequest: null,
      }
    : null,
  getPromptEditorTabId: (promptId) => `prompt:${promptId}`,
  getActiveEditorTabId: () => 'browser',
  setActiveEditorTabId() {},
  closeEditorTab: (tabId) => {
    closedEditorTabId = tabId;
  },
  findChatEditorTab: () => null,
  renderApp: () => {
    renderCalls += 1;
  },
  promptViewPanelElement,
  overlayRootElement,
  documentLike,
  bodyElement,
  windowLike: { innerHeight: 800, innerWidth: 1200 },
  getChatFileKey: (file) => `${file.projectId}:${file.chatId}:${file.messageId}:${file.sandboxPath}`,
  findLatestNewFileByKey: (fileKey) => latestNewFilesByKey.get(fileKey) ?? null,
  remoteManifestFile: '.chatgpt-remote/manifest.json',
  getRemoteManifestPrompt: (projectId) => `manifest for ${projectId}`,
  findSidebarProject: () => null,
  findSidebarChat: () => null,
  formatTimestamp: (value) => value ?? '',
  escapeHtml: (value) => String(value ?? ''),
  renderOpenFolderIcon: () => '<open-folder />',
  renderFileTreeFileIcon: () => '<file />',
  renderSharedFileTreeItem: () => '<item />',
  renderSharedFileTreeActionButton: () => '<action />',
  renderMoreActionsIcon: () => '<more />',
  setTimeoutImpl(callback) {
    callback();
    return 1;
  },
  clearTimeoutImpl() {},
});

await feature.actions.refreshPrompts(false);
await Promise.resolve();
await Promise.resolve();
assert.equal(promptDirectoryPath, '/prompts');
assert.equal(prompts.length, 1);
assert.equal(prompts[0].id, 'prompt-1');
assert.equal(promptContentCache.has('obsolete'), false);
assert.equal(promptContentCache.get('prompt-1'), 'cached');

feature.actions.openCreatePromptDialog();
assert.equal(feature.selectors.isPromptNameDialogOpen(), true);
assert.match(overlayRootElement.innerHTML, /New prompt/);
assert.equal(fakeInput.focused, true);
assert.equal(fakeInput.selected, true);

latestSnapshot = {
  directoryPath: '/prompts',
  prompts: [createPrompt('prompt-created', 'Fresh prompt')],
};
await feature.actions.submitPromptNameDialog('Fresh prompt');
assert.equal(openedPromptId, 'prompt-created');
assert.equal(feature.selectors.isPromptNameDialogOpen(), false);

feature.actions.setActivePromptMenu('prompt-created', true);
assert.equal(feature.selectors.isActivePromptMenuOpen(), true);
assert.equal(promptMenuRuntimeState.activePromptMenu?.promptId, 'prompt-created');
feature.actions.closeActivePromptMenu(false);
assert.equal(feature.selectors.isActivePromptMenuOpen(), false);

feature.actions.openArchiveApplyWarningDialog({
  projectId: 'project-1',
  projectName: 'Project 1',
  chatId: 'chat-1',
  messageId: 'msg-1',
  sandboxPath: 'bundle.zip',
  downloadUrl: null,
  downloadPath: null,
  fileName: 'bundle.zip',
  discoveredAt: '2026-04-23T07:00:00.000Z',
  updatedAt: '2026-04-23T07:00:00.000Z',
});
assert.equal(feature.selectors.isArchiveApplyWarningOpen(), true);
assert.match(overlayRootElement.innerHTML, /overwrite matching files in the current project folder/i);
assert.match(overlayRootElement.innerHTML, /Apply and overwrite/);
feature.actions.closeArchiveApplyWarningDialog();
assert.equal(feature.selectors.isArchiveApplyWarningOpen(), false);

feature.actions.openArchiveApplyWarningDialog({
  projectId: 'project-1',
  projectName: 'Project 1',
  chatId: 'chat-1',
  messageId: 'msg-2',
  sandboxPath: 'danger-bundle.zip',
  downloadUrl: null,
  downloadPath: null,
  fileName: 'danger-bundle.zip',
  discoveredAt: '2026-04-23T07:00:00.000Z',
  updatedAt: '2026-04-23T07:00:00.000Z',
});
assert.equal(feature.selectors.isArchiveApplyWarningOpen(), true);
assert.match(overlayRootElement.innerHTML, /dangerous to apply/i);
assert.match(overlayRootElement.innerHTML, /Apply anyway/);
assert.match(overlayRootElement.innerHTML, /danger-button/);
feature.actions.closeArchiveApplyWarningDialog();
assert.equal(feature.selectors.isArchiveApplyWarningOpen(), false);

feature.actions.openProjectPropertiesDialog('project-1');
assert.equal(feature.selectors.isPropertiesDialogOpen(), true);
feature.actions.closePropertiesDialog();
assert.equal(feature.selectors.isPropertiesDialogOpen(), false);

latestSnapshot = { directoryPath: '/prompts', prompts: [] };
await feature.actions.deletePrompt('prompt-1');
assert.equal(deletedPromptId, 'prompt-1');
assert.equal(closedEditorTabId, 'prompt:prompt-1');
assert.equal(promptContentCache.has('prompt-1'), false);

assert.ok(renderCalls >= 1);
assert.equal(renamedPromptCall, null);

if (previousWindow === undefined) {
  delete global.window;
} else {
  global.window = previousWindow;
}
if (previousHtmlInput === undefined) {
  delete global.HTMLInputElement;
} else {
  global.HTMLInputElement = previousHtmlInput;
}

console.log('renderer-prompts-feature-test: ok');
