import { spawnSync } from 'node:child_process';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ProjectRegistry } from './project-registry';
import { DebugLogEntry } from '../shared/contracts';
import { TerminalManager } from './terminal-manager';
import { getChatHistoryRevisionKey } from '../shared/chat-history-revision';
import { PromptStore } from './prompt-store';
import { GitService } from './git-service';

let mainWindow: BrowserWindow | null = null;
let projectRegistry: ProjectRegistry | null = null;
let promptStore: PromptStore | null = null;
const debugLogs: DebugLogEntry[] = [];
const MAX_DEBUG_LOGS = 1000;
let debugSequence = 0;

const RECENT_FILE_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;
const gitService = new GitService();

function resolveFileDragIconPath(): string {
  return path.join(__dirname, '..', 'assets', 'drag-icon.png');
}

function findProjectFolderPath(projectId: string): string | null {
  if (!projectRegistry) {
    return null;
  }

  const state = projectRegistry.getStateSnapshot();
  const project = [...state.persistentProjects, ...state.temporaryProjects].find((entry) => entry.projectId === projectId) ?? null;
  return project?.folderPath ?? null;
}

function normalizeRelativeProjectPath(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
  const normalized = raw.replace(/^\/+/, '');
  if (!normalized || normalized === '.') {
    return '';
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) {
    throw new Error('Invalid project-relative path.');
  }

  return segments.join('/');
}

function resolveProjectSubdirectory(folderPath: string, relativePath: string): string {
  const targetPath = path.resolve(folderPath, relativePath || '.');
  const relative = path.relative(folderPath, targetPath).replace(/\\/g, '/');
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Resolved path escapes the project folder.');
  }

  return targetPath;
}

function isRecentTimestamp(valueMs: number | bigint | null | undefined): boolean {
  const normalizedValue = typeof valueMs === 'bigint' ? Number(valueMs) : valueMs;
  return Number.isFinite(normalizedValue) && typeof normalizedValue === 'number' && Date.now() - normalizedValue <= RECENT_FILE_ACTIVITY_WINDOW_MS;
}

function resolveCreatedAtIso(valueMs: number | bigint | null | undefined): string | null {
  const normalizedValue = typeof valueMs === 'bigint' ? Number(valueMs) : valueMs;
  if (Number.isFinite(normalizedValue) && typeof normalizedValue === 'number' && normalizedValue > 0) {
    return new Date(normalizedValue).toISOString();
  }

  return null;
}

function normalizeGitIgnoreCandidatePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\.\//, '').trim();
}


function collectGitIgnoredEntries(
  folderPath: string,
  relativePath: string,
  entries: Array<{ relativePath: string; kind: 'file' | 'directory' }>,
): Set<string> {
  if (!existsSync(path.join(folderPath, '.git'))) {
    return new Set();
  }

  const candidates: string[] = [];
  const parentRelativePath = normalizeGitIgnoreCandidatePath(relativePath);
  if (parentRelativePath) {
    candidates.push(parentRelativePath, `${parentRelativePath}/`);
  }

  for (const entry of entries) {
    const normalizedPath = normalizeGitIgnoreCandidatePath(entry.relativePath);
    if (!normalizedPath) {
      continue;
    }

    candidates.push(normalizedPath);
    if (entry.kind === 'directory') {
      candidates.push(`${normalizedPath}/`);
    }
  }

  if (!candidates.length) {
    return new Set();
  }

  const result = spawnSync(
    'git',
    ['-C', folderPath, 'check-ignore', '--stdin'],
    {
      input: `${candidates.join('\n')}\n`,
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.status !== 0 && result.status !== 1) {
    return new Set();
  }

  const ignored = new Set(
    (result.stdout || '')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => normalizeGitIgnoreCandidatePath(line))
      .filter(Boolean),
  );

  if (parentRelativePath && ignored.has(parentRelativePath)) {
    for (const entry of entries) {
      ignored.add(normalizeGitIgnoreCandidatePath(entry.relativePath));
    }
  }

  return ignored;
}

function collectDirectoryRecentStatus(directoryPath: string): { containsRecentModifiedFiles: boolean } {
  const stack = [directoryPath];

  while (stack.length) {
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }

    const children = readdirSync(currentPath, { withFileTypes: true }).filter((entry) => entry.name !== '.chatgpt');
    for (const child of children) {
      const childPath = path.join(currentPath, child.name);
      if (child.isDirectory()) {
        stack.push(childPath);
        continue;
      }

      if (!child.isFile()) {
        continue;
      }

      const childStats = statSync(childPath);
      const isNewFile = isRecentTimestamp(childStats.birthtimeMs);
      const isRecentlyModified = isRecentTimestamp(childStats.mtimeMs);
      if (isRecentlyModified && !isNewFile) {
        return { containsRecentModifiedFiles: true };
      }
    }
  }

  return { containsRecentModifiedFiles: false };
}

function listVisibleProjectEntries(folderPath: string, relativePath: string): Array<{
  name: string;
  relativePath: string;
  fullPath: string;
  kind: 'file' | 'directory';
  hasChildren: boolean;
  modifiedAt: string | null;
  createdAt: string | null;
  containsRecentModifiedFiles: boolean;
  isGitIgnored: boolean;
}> {
  const directoryPath = resolveProjectSubdirectory(folderPath, relativePath);
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
    return [];
  }

  const entries = readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.name !== '.chatgpt')
    .map((entry) => {
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const fullPath = path.join(directoryPath, entry.name);
      const stats = statSync(fullPath);
      const isDirectory = entry.isDirectory();
      const hasChildren = isDirectory
        ? readdirSync(fullPath, { withFileTypes: true }).some((child) => child.name !== '.chatgpt')
        : false;
      const createdAt = resolveCreatedAtIso(stats.birthtimeMs);
      const containsRecentModifiedFiles = isDirectory ? collectDirectoryRecentStatus(fullPath).containsRecentModifiedFiles : false;
      return {
        name: entry.name,
        relativePath: entryRelativePath,
        fullPath,
        kind: isDirectory ? 'directory' as const : 'file' as const,
        hasChildren,
        modifiedAt: Number.isFinite(stats.mtimeMs) ? new Date(stats.mtimeMs).toISOString() : null,
        createdAt,
        containsRecentModifiedFiles,
        isGitIgnored: false,
      };
    });

  const ignoredEntries = collectGitIgnoredEntries(
    folderPath,
    relativePath,
    entries.map((entry) => ({ relativePath: entry.relativePath, kind: entry.kind })),
  );

  entries.forEach((entry) => {
    entry.isGitIgnored = ignoredEntries.has(normalizeGitIgnoreCandidatePath(entry.relativePath));
  });

  entries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  });

  return entries;
}

const terminalManager = new TerminalManager({
  onData: ({ sessionId, data }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('terminal:data', { sessionId, data });
  },
  onExit: ({ sessionId, exitCode, signal }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('terminal:exit', { sessionId, exitCode, signal });
  },
});

function resolveRendererHtmlPath(): string {
  return path.join(__dirname, '..', 'renderer', 'index.html');
}

function resolveAppPreloadPath(): string {
  return path.join(__dirname, '..', 'preload', 'app-preload.js');
}

function resolvePromptsDirectoryPath(): string {
  return path.join(app.getPath('userData'), 'prompts');
}

function broadcastState(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !projectRegistry) {
    return;
  }

  mainWindow.webContents.send('app:state-changed', projectRegistry.getStateSnapshot());
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeTimestamp(value: unknown): string {
  const normalized = normalizeText(value);
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function normalizeDebugLogEntry(payload: unknown): DebugLogEntry | null {
  const candidate = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  if (!candidate) {
    return null;
  }

  const level = candidate.level === 'warn' || candidate.level === 'error' ? candidate.level : 'info';
  const message = normalizeText(candidate.message);
  if (!message) {
    return null;
  }

  const details = normalizeText(candidate.details) || null;

  debugSequence += 1;
  return {
    id: `debug-${Date.now()}-${debugSequence}`,
    level,
    message,
    details,
    source:
      candidate.source === 'guest-preload' || candidate.source === 'webview' || candidate.source === 'injected-script'
        ? candidate.source
        : 'injected-script',
    timestamp: normalizeTimestamp(candidate.timestamp),
  };
}

function appendDebugLog(entry: DebugLogEntry): void {
  debugLogs.push(entry);
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.splice(0, debugLogs.length - MAX_DEBUG_LOGS);
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('debug:entry', entry);
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f5f1e8',
    webPreferences: {
      preload: resolveAppPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  mainWindow.on('closed', () => {
    terminalManager.close();
    mainWindow = null;
  });

  await mainWindow.loadFile(resolveRendererHtmlPath());
}

function registerIpc(): void {
  ipcMain.handle('app:get-state', () => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    return projectRegistry.getStateSnapshot();
  });

  ipcMain.handle('debug:get-entries', () => {
    return debugLogs;
  });

  ipcMain.handle('debug:clear', () => {
    debugLogs.length = 0;
  });

  ipcMain.handle('chat-history:get', async (_event, payload: { projectId: string; chatId: string }) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    return projectRegistry.getChatHistory(payload.projectId, payload.chatId);
  });

  ipcMain.handle(
    'chat-history:get-thoughts',
    async (_event, payload: { projectId: string; chatId: string; messageId: string }) => {
      if (!projectRegistry) {
        throw new Error('Project registry is not ready.');
      }

      return projectRegistry.getChatMessageThoughts(payload.projectId, payload.chatId, payload.messageId);
    },
  );

  ipcMain.handle('chat-history:save-json', async (event, payload: { defaultFileName?: string; content?: string }) => {
    const content = typeof payload?.content === 'string' ? payload.content : '';
    if (!content) {
      return { saved: false, filePath: null, errorMessage: 'No chat history JSON content was provided.' };
    }

    const defaultFileName = typeof payload?.defaultFileName === 'string' && payload.defaultFileName.trim()
      ? payload.defaultFileName.trim()
      : 'chat-history.json';
    const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    const saveOptions = {
      title: 'Save chat history JSON',
      defaultPath: defaultFileName,
      filters: [
        { name: 'JSON files', extensions: ['json'] },
        { name: 'All files', extensions: ['*'] },
      ],
    };
    const result = parentWindow
      ? await dialog.showSaveDialog(parentWindow, saveOptions)
      : await dialog.showSaveDialog(saveOptions);

    if (result.canceled || !result.filePath) {
      return { saved: false, filePath: null, errorMessage: null };
    }

    await writeFile(result.filePath, content, 'utf8');
    return { saved: true, filePath: result.filePath, errorMessage: null };
  });

  ipcMain.handle('chatgpt-file:register', async (_event, payload: unknown) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    const result = await projectRegistry.registerSandboxFile(payload);
    broadcastState();
    return result;
  });

  ipcMain.handle('chatgpt-file:register-many', async (_event, payload: unknown) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    const result = await projectRegistry.registerSandboxFiles(payload);
    broadcastState();
    return result;
  });

  ipcMain.handle('chatgpt-file:save', async (_event, payload: unknown) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    const result = await projectRegistry.saveDownloadedSandboxFile(payload);
    broadcastState();
    return result;
  });


  ipcMain.handle('terminal:get-state', () => {
    return terminalManager.getSnapshots();
  });

  ipcMain.handle('project:connect', async (event, projectId: string) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!parentWindow) {
      throw new Error('Main window is unavailable.');
    }

    const result = await projectRegistry.connectProject(projectId, parentWindow);
    broadcastState();
    return result;
  });

  ipcMain.handle('project:remove', async (_event, projectId: string) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    const removed = projectRegistry.removeProject(projectId);
    if (removed) {
      broadcastState();
    }

    return removed;
  });

  ipcMain.handle('chat:remove', async (_event, payload: { projectId: string; chatId: string }) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    const removed = await projectRegistry.removeChat(payload.projectId, payload.chatId);
    if (removed) {
      broadcastState();
    }

    return removed;
  });

  ipcMain.handle('app:open-folder', async (_event, folderPath: string) => {
    const normalizedFolderPath = typeof folderPath === 'string' ? folderPath.trim() : '';
    if (!normalizedFolderPath) {
      return '';
    }

    return shell.openPath(path.normalize(normalizedFolderPath));
  });

  ipcMain.handle('app:show-item-in-folder', async (_event, fullPath: string) => {
    const normalizedFullPath = typeof fullPath === 'string' ? fullPath.trim() : '';
    if (!normalizedFullPath) {
      return false;
    }

    shell.showItemInFolder(path.normalize(normalizedFullPath));
    return true;
  });


  ipcMain.handle('prompts:list', async () => {
    if (!promptStore) {
      throw new Error('Prompt store is not ready.');
    }

    return promptStore.listPrompts();
  });

  ipcMain.handle('prompts:create', async (_event, name: string) => {
    if (!promptStore) {
      throw new Error('Prompt store is not ready.');
    }

    return promptStore.createPrompt(name);
  });

  ipcMain.handle('prompts:rename', async (_event, payload: { promptId: string; name: string }) => {
    if (!promptStore) {
      throw new Error('Prompt store is not ready.');
    }

    return promptStore.renamePrompt(payload?.promptId, payload?.name);
  });

  ipcMain.handle('prompts:delete', async (_event, promptId: string) => {
    if (!promptStore) {
      throw new Error('Prompt store is not ready.');
    }

    return promptStore.deletePrompt(promptId);
  });

  ipcMain.handle('prompts:read', async (_event, promptId: string) => {
    if (!promptStore) {
      throw new Error('Prompt store is not ready.');
    }

    return promptStore.readPrompt(promptId);
  });

  ipcMain.handle('prompts:write', async (_event, payload: { promptId: string; content: string }) => {
    if (!promptStore) {
      throw new Error('Prompt store is not ready.');
    }

    return promptStore.writePrompt(payload?.promptId, payload?.content ?? '');
  });

  ipcMain.handle('prompts:open-folder', async () => {
    if (!promptStore) {
      throw new Error('Prompt store is not ready.');
    }

    const directoryPath = await promptStore.ensureDirectory();
    return shell.openPath(directoryPath);
  });

  ipcMain.handle('app:list-project-files', async (_event, payload: { projectId: string; relativePath?: string | null }) => {
    const projectId = typeof payload?.projectId === 'string' ? payload.projectId.trim() : '';
    if (!projectId) {
      return [];
    }

    const folderPath = findProjectFolderPath(projectId);
    if (!folderPath) {
      return [];
    }

    const relativePath = normalizeRelativeProjectPath(payload?.relativePath);
    return listVisibleProjectEntries(folderPath, relativePath);
  });

  ipcMain.handle(
    'project:list-sandbox-file-archive-entries',
    async (
      _event,
      payload: { projectId: string; chatId: string; messageId: string; sandboxPath: string },
    ) => {
      if (!projectRegistry) {
        throw new Error('Project registry is not ready.');
      }

      return projectRegistry.listSandboxFileArchiveEntries(
        payload?.projectId,
        payload?.chatId,
        payload?.messageId,
        payload?.sandboxPath,
      );
    },
  );

  ipcMain.handle(
    'project:apply-sandbox-file',
    async (
      _event,
      payload: { projectId: string; chatId: string; messageId: string; sandboxPath: string; relativePath?: string | null },
    ) => {
      if (!projectRegistry) {
        throw new Error('Project registry is not ready.');
      }

      const result = await projectRegistry.applySandboxFile(
        payload?.projectId,
        payload?.chatId,
        payload?.messageId,
        payload?.sandboxPath,
        payload?.relativePath,
      );
      broadcastState();
      return result;
    },
  );

  ipcMain.handle('project:create-bundle', async (_event, projectId: string) => {
    if (!projectRegistry) {
      throw new Error('Project registry is not ready.');
    }

    const result = await projectRegistry.createBundle(projectId);
    broadcastState();
    return result;
  });

  ipcMain.handle('git:get-overview', async (_event, payload: { projectId: string; refName?: string | null }) => {
    const projectId = typeof payload?.projectId === 'string' ? payload.projectId.trim() : '';
    if (!projectId) {
      return { kind: 'missing' } as const;
    }

    const folderPath = findProjectFolderPath(projectId);
    if (!folderPath) {
      return { kind: 'missing' } as const;
    }

    return gitService.getOverview(folderPath, payload?.refName);
  });


  ipcMain.handle('git:get-commit-details', async (_event, payload: { projectId: string; commitHash: string }) => {
    const projectId = typeof payload?.projectId === 'string' ? payload.projectId.trim() : '';
    const commitHash = typeof payload?.commitHash === 'string' ? payload.commitHash.trim() : '';
    if (!projectId || !commitHash) {
      return { kind: 'missing' } as const;
    }

    const folderPath = findProjectFolderPath(projectId);
    if (!folderPath) {
      return { kind: 'missing' } as const;
    }

    return gitService.getCommitDetails(folderPath, commitHash);
  });

  ipcMain.on('app:start-file-drag', (event, payload: { fullPath: string }) => {
    const fullPath = typeof payload?.fullPath === 'string' ? payload.fullPath.trim() : '';
    if (!fullPath || !existsSync(fullPath)) {
      return;
    }

    const normalizedFullPath = path.normalize(fullPath);
    const iconPath = resolveFileDragIconPath();
    if (!existsSync(iconPath)) {
      return;
    }

    event.sender.startDrag({
      file: normalizedFullPath,
      icon: iconPath,
    });
  });

  ipcMain.handle(
    'terminal:start',
    async (_event, payload: { cwd: string | null; cols: number; rows: number }) => {
      return terminalManager.open(payload);
    },
  );

  ipcMain.handle('terminal:write', async (_event, payload: { sessionId: string; data: string }) => {
    terminalManager.write(payload.sessionId, payload.data);
  });

  ipcMain.handle('terminal:resize', async (_event, payload: { sessionId: string; cols: number; rows: number }) => {
    terminalManager.resize(payload.sessionId, payload.cols, payload.rows);
  });

  ipcMain.handle('terminal:close', async (_event, sessionId?: string) => {
    terminalManager.close(sessionId);
  });

  ipcMain.on('chatgpt-page:context', (_event, payload: unknown) => {
    if (!projectRegistry) {
      return;
    }

    void projectRegistry
      .handlePageContext(payload)
      .then(() => {
        broadcastState();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[chatgpt-page:context]', message);
      });
  });

  ipcMain.on('chatgpt-page:conversation-history', (_event, payload: unknown) => {
    if (!projectRegistry) {
      return;
    }

    void projectRegistry
      .handleConversationHistory(payload)
      .then((history) => {
        if (!history || !mainWindow || mainWindow.isDestroyed()) {
          return;
        }

        mainWindow.webContents.send('chat-history:updated', {
          projectId: history.projectId,
          chatId: history.chatId,
          revisionKey: getChatHistoryRevisionKey(history),
          updatedAt: history.updatedAt ?? null,
          capturedAt: history.capturedAt,
          messageCount: history.messageCount,
          isPartial: history.isPartial === true,
        });
        broadcastState();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[chatgpt-page:conversation-history]', message);
      });
  });

  ipcMain.on('chatgpt-page:debug', (_event, payload: unknown) => {
    const entry = normalizeDebugLogEntry(payload);
    if (!entry) {
      return;
    }

    appendDebugLog(entry);
  });
}

async function bootstrap(): Promise<void> {
  projectRegistry = await ProjectRegistry.create(path.join(app.getPath('userData'), 'state.json'));
  promptStore = new PromptStore(resolvePromptsDirectoryPath());
  await promptStore.ensureDirectory();
  registerIpc();
  await createMainWindow();
  broadcastState();
}

app.whenReady().then(() => {
  void bootstrap();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow().then(() => {
        broadcastState();
      });
    }
  });
});

app.on('window-all-closed', () => {
  terminalManager.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
