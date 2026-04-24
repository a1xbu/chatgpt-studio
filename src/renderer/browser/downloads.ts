import type {
  AppStateSnapshot,
  ChatFileRecord,
  DebugLogEntry,
  SidebarProject,
} from '../../shared/contracts';
import type { ChatEditorTab } from '../editor/types';
import type { FileDownloadRuntimeStatus, WebviewElement } from '../runtime-types';
import type { SidebarSelection } from '../sidebar/types';

const FILE_DOWNLOAD_RUNTIME_STATUSES: ReadonlySet<FileDownloadRuntimeStatus['status']> = new Set([
  'waiting',
  'resolving',
  'downloading',
  'saving',
  'downloaded',
  'cancelled',
  'error',
]);

type LatestNewFileEntry = {
  project: SidebarProject;
  file: ChatFileRecord;
};

export type SendBrowserFileCommandOptions = {
  browserElement: WebviewElement | null;
  addDebugLog: (source: DebugLogEntry['source'], level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
};

export function sendBrowserFileCommand(
  command: 'enqueue-file-download' | 'cancel-file-download',
  file: ChatFileRecord,
  options: SendBrowserFileCommandOptions,
): void {
  if (!options.browserElement || typeof options.browserElement.send !== 'function') {
    options.addDebugLog('webview', 'warn', 'Unable to send a sandbox file command because the embedded browser is not ready.');
    return;
  }

  options.browserElement.send('chatgpt-file:command', {
    command,
    file: {
      projectId: file.projectId,
      projectName: file.projectName,
      chatId: file.chatId,
      messageId: file.messageId,
      sandboxPath: file.sandboxPath,
      fileName: file.fileName,
      downloadPath: file.downloadPath ?? null,
      discoveredAt: file.discoveredAt,
      updatedAt: file.updatedAt,
    },
  });
}

export type QueueAutomaticSandboxDownloadsOptions = {
  downloadAutomatically: boolean;
  currentState: AppStateSnapshot | null;
  selectedSidebarItem: SidebarSelection | null;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  getLatestNewFiles: (projects: SidebarProject[], selection: SidebarSelection | null) => LatestNewFileEntry[];
  getChatFileKey: (file: ChatFileRecord) => string;
  sendBrowserFileCommand: (command: 'enqueue-file-download' | 'cancel-file-download', file: ChatFileRecord) => void;
  newIsoTimestamp?: () => string;
};

export function queueAutomaticSandboxDownloads(options: QueueAutomaticSandboxDownloadsOptions): void {
  if (!options.downloadAutomatically || !options.currentState) {
    return;
  }

  const entries = options.getLatestNewFiles(options.getAllSidebarProjects(options.currentState), options.selectedSidebarItem);
  for (const { project, file } of entries) {
    if (!project.folderPath || file.downloadPath) {
      continue;
    }

    const fileKey = options.getChatFileKey(file);
    if (options.fileDownloadStatuses.has(fileKey)) {
      continue;
    }

    options.fileDownloadStatuses.set(fileKey, {
      projectId: file.projectId,
      chatId: file.chatId,
      messageId: file.messageId,
      sandboxPath: file.sandboxPath,
      fileName: file.fileName ?? null,
      status: 'waiting',
      progressPercent: 0,
      message: 'Waiting in queue',
      downloadPath: file.downloadPath ?? null,
      updatedAt: (options.newIsoTimestamp ?? (() => new Date().toISOString()))(),
    });
    options.sendBrowserFileCommand('enqueue-file-download', file);
  }
}

function isFileDownloadRuntimeStatus(value: string): value is FileDownloadRuntimeStatus['status'] {
  return FILE_DOWNLOAD_RUNTIME_STATUSES.has(value as FileDownloadRuntimeStatus['status']);
}

export type HandleBrowserSandboxFileStatusOptions = {
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  findChatEditorTab: (projectId: string, chatId: string) => ChatEditorTab | null;
  reloadChatHistoryIntoTab: (tab: ChatEditorTab, forceReload: boolean) => Promise<void>;
  render: () => void;
};

export function handleBrowserSandboxFileStatus(payload: unknown, options: HandleBrowserSandboxFileStatusOptions): void {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  const candidate = payload as Record<string, unknown>;
  const projectId = typeof candidate.projectId === 'string' ? candidate.projectId.trim() : '';
  const chatId = typeof candidate.chatId === 'string' ? candidate.chatId.trim() : '';
  const messageId = typeof candidate.messageId === 'string' ? candidate.messageId.trim() : '';
  const sandboxPath = typeof candidate.sandboxPath === 'string' ? candidate.sandboxPath.trim() : '';
  const statusValue = typeof candidate.status === 'string' ? candidate.status.trim() : '';
  if (!projectId || !chatId || !messageId || !sandboxPath || !isFileDownloadRuntimeStatus(statusValue)) {
    return;
  }

  const fileKey = `${chatId}::${messageId}::${sandboxPath}`;
  options.fileDownloadStatuses.set(fileKey, {
    projectId,
    chatId,
    messageId,
    sandboxPath,
    fileName: typeof candidate.fileName === 'string' ? candidate.fileName.trim() : null,
    status: statusValue,
    progressPercent: typeof candidate.progressPercent === 'number' && Number.isFinite(candidate.progressPercent) ? candidate.progressPercent : null,
    message: typeof candidate.message === 'string' ? candidate.message.trim() : null,
    downloadPath: typeof candidate.downloadPath === 'string' ? candidate.downloadPath.trim() : null,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  });

  if (statusValue === 'downloaded') {
    const targetTab = options.findChatEditorTab(projectId, chatId);
    if (targetTab) {
      void options.reloadChatHistoryIntoTab(targetTab, true);
    }
  }

  options.render();
}
