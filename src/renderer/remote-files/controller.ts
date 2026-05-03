import type { ChatFileRecord, DebugLogEntry, SidebarProject } from '../../shared/contracts';
import type { FileDownloadRuntimeStatus } from '../runtime-types';
import type { RemoteFilesEventsHelpers } from './events';
import { canApplyRemoteFile } from './panel';

export type RemoteFilesControllerOptions = {
  findClosestHtmlElement: RemoteFilesEventsHelpers['findClosestHtmlElement'];
  toggleCollapsed: () => void;
  getLatestEntries: () => Array<{ project: SidebarProject; file: ChatFileRecord }>;
  render: () => void;
  runApplyAllNewFiles: (entries: Array<{ project: SidebarProject; file: ChatFileRecord }>) => Promise<void>;
  findLatestEntryByKey: (fileKey: string) => { project: SidebarProject; file: ChatFileRecord } | null;
  getRootKey: (file: ChatFileRecord) => string;
  getBranchKey: (file: ChatFileRecord, relativePath: string) => string;
  expandedKeys: Set<string>;
  archiveEntriesByFileKey: Map<string, unknown[]>;
  loadArchiveEntriesForFile: (file: ChatFileRecord) => Promise<void> | void;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  sendBrowserFileCommand: RemoteFilesEventsHelpers['sendBrowserFileCommand'];
  shouldWarnBeforeApplyingArchive: (file: ChatFileRecord) => boolean;
  openArchiveApplyWarningDialog: (file: ChatFileRecord, relativePath?: string | null) => void;
  runApplySandboxFile: (file: ChatFileRecord, relativePath?: string | null) => Promise<unknown>;
  showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
  addDebugLog: (source: DebugLogEntry['source'], level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
  setDownloadAutomatically: (checked: boolean) => void;
  persistDownloadAutomatically: (checked: boolean) => void;
  queueAutomaticSandboxDownloads: () => void;
  getEffectiveDownloadPath: (file: ChatFileRecord) => string | null;
  showItemInFolder: (filePath: string) => Promise<unknown> | void;
  newIsoTimestamp: () => string;
};

export function createRemoteFilesEventHelpers(options: RemoteFilesControllerOptions): RemoteFilesEventsHelpers {
  return {
    findClosestHtmlElement: options.findClosestHtmlElement,
    toggleCollapsed: options.toggleCollapsed,
    getApplicableEntries: () => options.getLatestEntries().filter(({ file }) => canApplyRemoteFile(file, options.getEffectiveDownloadPath(file))),
    render: options.render,
    applyAllFiles: (entries) => options.runApplyAllNewFiles(entries as Array<{ project: SidebarProject; file: ChatFileRecord }>),
    findLatestEntryByKey: options.findLatestEntryByKey,
    getRootKey: options.getRootKey,
    getBranchKey: options.getBranchKey,
    expandedKeys: options.expandedKeys,
    getArchiveEntriesLength: (fileKey) => options.archiveEntriesByFileKey.get(fileKey)?.length ?? 0,
    loadArchiveEntries: options.loadArchiveEntriesForFile,
    markWaitingDownload: (fileKey, file) => {
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
        updatedAt: options.newIsoTimestamp(),
      });
    },
    sendBrowserFileCommand: options.sendBrowserFileCommand,
    getEffectiveDownloadPath: options.getEffectiveDownloadPath,
    showItemInFolder: options.showItemInFolder,
    shouldWarnBeforeApplyingArchive: options.shouldWarnBeforeApplyingArchive,
    openArchiveApplyWarningDialog: options.openArchiveApplyWarningDialog,
    runApplySandboxFile: options.runApplySandboxFile,
    showRemoteFilesNotice: options.showRemoteFilesNotice,
    addDebugLog: (source, level, message, details) => options.addDebugLog(source as DebugLogEntry['source'], level, message, details),
    setDownloadAutomatically: options.setDownloadAutomatically,
    persistDownloadAutomatically: options.persistDownloadAutomatically,
    queueAutomaticSandboxDownloads: options.queueAutomaticSandboxDownloads,
  };
}
