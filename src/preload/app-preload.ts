import { contextBridge, ipcRenderer } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const guestPreloadUrl = pathToFileURL(path.join(__dirname, '..', 'browser', 'guest-preload.js')).toString();

contextBridge.exposeInMainWorld('desktopPoc', {
  getBootstrap: async () => ({
    state: await ipcRenderer.invoke('app:get-state'),
    debugLogs: await ipcRenderer.invoke('debug:get-entries'),
    terminalSnapshots: await ipcRenderer.invoke('terminal:get-state'),
    browser: {
      url: 'https://chatgpt.com',
      partition: 'persist:chatgpt-poc',
      preloadUrl: guestPreloadUrl,
    },
  }),
  clearDebugLogs: () => ipcRenderer.invoke('debug:clear'),
  getChatHistory: (projectId: string, chatId: string) => ipcRenderer.invoke('chat-history:get', { projectId, chatId }),
  saveChatHistoryJson: (defaultFileName: string, content: string) =>
    ipcRenderer.invoke('chat-history:save-json', { defaultFileName, content }),
  connectProject: (projectId: string) => ipcRenderer.invoke('project:connect', projectId),
  removeProject: (projectId: string) => ipcRenderer.invoke('project:remove', projectId),
  removeChat: (projectId: string, chatId: string) => ipcRenderer.invoke('chat:remove', { projectId, chatId }),
  listPrompts: () => ipcRenderer.invoke('prompts:list'),
  createPrompt: (name: string) => ipcRenderer.invoke('prompts:create', name),
  renamePrompt: (promptId: string, name: string) => ipcRenderer.invoke('prompts:rename', { promptId, name }),
  deletePrompt: (promptId: string) => ipcRenderer.invoke('prompts:delete', promptId),
  readPrompt: (promptId: string) => ipcRenderer.invoke('prompts:read', promptId),
  writePrompt: (promptId: string, content: string) => ipcRenderer.invoke('prompts:write', { promptId, content }),
  openPromptsFolder: () => ipcRenderer.invoke('prompts:open-folder'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('app:open-folder', folderPath),
  showItemInFolder: (fullPath: string) => ipcRenderer.invoke('app:show-item-in-folder', fullPath),
  listProjectFiles: (projectId: string, relativePath?: string | null) => ipcRenderer.invoke('app:list-project-files', { projectId, relativePath }),
  listSandboxFileArchiveEntries: (projectId: string, chatId: string, messageId: string, sandboxPath: string) =>
    ipcRenderer.invoke('project:list-sandbox-file-archive-entries', { projectId, chatId, messageId, sandboxPath }),
  applySandboxFile: (
    projectId: string,
    chatId: string,
    messageId: string,
    sandboxPath: string,
    relativePath?: string | null,
  ) => ipcRenderer.invoke('project:apply-sandbox-file', { projectId, chatId, messageId, sandboxPath, relativePath }),
  createProjectBundle: (projectId: string) => ipcRenderer.invoke('project:create-bundle', projectId),
  getGitOverview: (projectId: string, refName?: string | null) => ipcRenderer.invoke('git:get-overview', { projectId, refName }),
  getGitCommitDetails: (projectId: string, commitHash: string) => ipcRenderer.invoke('git:get-commit-details', { projectId, commitHash }),
  startFileDrag: (fullPath: string) => ipcRenderer.send('app:start-file-drag', { fullPath }),
  startTerminal: (cwd: string | null, cols: number, rows: number) => ipcRenderer.invoke('terminal:start', { cwd, cols, rows }),
  writeTerminal: (sessionId: string, data: string) => ipcRenderer.invoke('terminal:write', { sessionId, data }),
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', { sessionId, cols, rows }),
  closeTerminal: (sessionId?: string) => ipcRenderer.invoke('terminal:close', sessionId),
  onStateChanged: (listener: (state: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      listener(state);
    };

    ipcRenderer.on('app:state-changed', wrappedListener);

    return () => {
      ipcRenderer.removeListener('app:state-changed', wrappedListener);
    };
  },
  onDebugEntry: (listener: (entry: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, entry: unknown) => {
      listener(entry);
    };

    ipcRenderer.on('debug:entry', wrappedListener);

    return () => {
      ipcRenderer.removeListener('debug:entry', wrappedListener);
    };
  },
  onChatHistoryUpdated: (listener: (payload: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      listener(payload);
    };

    ipcRenderer.on('chat-history:updated', wrappedListener);

    return () => {
      ipcRenderer.removeListener('chat-history:updated', wrappedListener);
    };
  },
  onTerminalData: (listener: (payload: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      listener(payload);
    };

    ipcRenderer.on('terminal:data', wrappedListener);

    return () => {
      ipcRenderer.removeListener('terminal:data', wrappedListener);
    };
  },
  onTerminalExit: (listener: (payload: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      listener(payload);
    };

    ipcRenderer.on('terminal:exit', wrappedListener);

    return () => {
      ipcRenderer.removeListener('terminal:exit', wrappedListener);
    };
  },
});
