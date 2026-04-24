import type {
  AppStateSnapshot,
  ApplySandboxFileResult,
  ChatFileArchiveEntryRecord,
  ChatFileRecord,
  SidebarProject,
} from '../../shared/contracts';
import type {
  RendererAppStoreSlice,
  RendererFilesStoreSlice,
  RendererRemoteFilesStoreSlice,
  RendererWorkspaceStoreSlice,
} from '../app/store';
import {
  clearArchiveEntriesCacheForProject,
  clearLocalFileTreeCache,
  ensureArchiveEntriesForVisibleNewFiles,
  getEffectiveDownloadPath,
  loadArchiveEntriesForFile,
  refreshArchiveEntriesForFile,
  runApplyAllNewFiles,
  runApplySandboxFile,
  showRemoteFilesNotice,
} from '../files/runtime';

export type RendererRemoteFilesRuntime = {
  clearLocalFileTreeCache: (projectId: string) => void;
  clearArchiveEntriesCacheForProject: (projectId: string) => void;
  getEffectiveDownloadPath: (file: ChatFileRecord) => string | null;
  loadArchiveEntriesForFile: (file: ChatFileRecord) => Promise<void>;
  refreshArchiveEntriesForFile: (file: Pick<ChatFileRecord, 'projectId' | 'chatId' | 'messageId' | 'sandboxPath'>) => void;
  ensureArchiveEntriesForVisibleNewFiles: (entries: Array<{ project: SidebarProject; file: ChatFileRecord }>) => void;
  showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
  runApplySandboxFile: (file: ChatFileRecord, relativePath?: string | null) => Promise<ApplySandboxFileResult>;
  runApplyAllNewFiles: (entries: Array<{ project: SidebarProject; file: ChatFileRecord }>) => Promise<void>;
};

export type CreateRendererRemoteFilesRuntimeOptions = {
  appState: RendererAppStoreSlice;
  workspaceState: RendererWorkspaceStoreSlice;
  filesState: RendererFilesStoreSlice;
  remoteFilesState: RendererRemoteFilesStoreSlice;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  render: () => void;
  desktopApi: {
    listSandboxFileArchiveEntries: (projectId: string, chatId: string, messageId: string, sandboxPath: string) => Promise<ChatFileArchiveEntryRecord[]>;
    applySandboxFile: (projectId: string, chatId: string, messageId: string, sandboxPath: string, relativePath?: string | null) => Promise<ApplySandboxFileResult>;
  };
  timers: {
    setTimeout: (callback: () => void, delayMs: number) => number;
    clearTimeout: (timerId: number) => void;
  };
  getAllProjectsForRefresh: (state: AppStateSnapshot) => SidebarProject[];
  refreshLocalProjectTree: (projectId: string) => void;
};

export function createRendererRemoteFilesRuntime(options: CreateRendererRemoteFilesRuntimeOptions): RendererRemoteFilesRuntime {
  const runtime: RendererRemoteFilesRuntime = {
    clearLocalFileTreeCache: (projectId) => {
      clearLocalFileTreeCache(projectId, {
        localFileEntriesByKey: options.filesState.localFileEntriesByKey,
        localFileErrorsByKey: options.filesState.localFileErrorsByKey,
        localFileLoadingKeys: options.filesState.localFileLoadingKeys,
      });
    },
    clearArchiveEntriesCacheForProject: (projectId) => {
      clearArchiveEntriesCacheForProject({
        projectId,
        currentState: options.appState.currentState,
        getAllSidebarProjects: options.getAllProjectsForRefresh,
        archiveEntriesByFileKey: options.remoteFilesState.archiveEntriesByFileKey,
        archiveEntryErrorsByFileKey: options.remoteFilesState.archiveEntryErrorsByFileKey,
        archiveEntryLoadingKeys: options.remoteFilesState.archiveEntryLoadingKeys,
      });
    },
    getEffectiveDownloadPath: (file) => getEffectiveDownloadPath(file, options.remoteFilesState.fileDownloadStatuses),
    loadArchiveEntriesForFile: async (file) => {
      await loadArchiveEntriesForFile({
        file,
        archiveEntriesByFileKey: options.remoteFilesState.archiveEntriesByFileKey,
        archiveEntryErrorsByFileKey: options.remoteFilesState.archiveEntryErrorsByFileKey,
        archiveEntryLoadingKeys: options.remoteFilesState.archiveEntryLoadingKeys,
        render: options.render,
        listSandboxFileArchiveEntries: options.desktopApi.listSandboxFileArchiveEntries,
      });
    },
    refreshArchiveEntriesForFile: (file) => {
      refreshArchiveEntriesForFile({
        file,
        currentState: options.appState.currentState,
        selectedSidebarItem: options.workspaceState.selectedSidebarItem,
        getAllSidebarProjects: options.getAllSidebarProjects,
        archiveEntriesByFileKey: options.remoteFilesState.archiveEntriesByFileKey,
        archiveEntryErrorsByFileKey: options.remoteFilesState.archiveEntryErrorsByFileKey,
        archiveEntryLoadingKeys: options.remoteFilesState.archiveEntryLoadingKeys,
        fileDownloadStatuses: options.remoteFilesState.fileDownloadStatuses,
        loadArchiveEntriesForFile: runtime.loadArchiveEntriesForFile,
      });
    },
    ensureArchiveEntriesForVisibleNewFiles: (entries) => {
      ensureArchiveEntriesForVisibleNewFiles({
        entries,
        fileDownloadStatuses: options.remoteFilesState.fileDownloadStatuses,
        loadArchiveEntriesForFile: runtime.loadArchiveEntriesForFile,
      });
    },
    showRemoteFilesNotice: (message, tone = 'success') => {
      showRemoteFilesNotice({
        message,
        tone,
        setNotice: (notice) => {
          options.remoteFilesState.remoteFilesNotice = notice;
        },
        getNoticeTimer: () => options.remoteFilesState.remoteFilesNoticeTimer,
        setNoticeTimer: (timerId) => {
          options.remoteFilesState.remoteFilesNoticeTimer = timerId;
        },
        clearTimeoutImpl: options.timers.clearTimeout,
        setTimeoutImpl: options.timers.setTimeout,
        render: options.render,
      });
    },
    runApplySandboxFile: async (file, relativePath) => {
      return runApplySandboxFile({
        file,
        relativePath,
        applySandboxFile: options.desktopApi.applySandboxFile,
        refreshArchiveEntriesForFile: runtime.refreshArchiveEntriesForFile,
        refreshLocalProjectTree: options.refreshLocalProjectTree,
        showRemoteFilesNotice: runtime.showRemoteFilesNotice,
      });
    },
    runApplyAllNewFiles: async (entries) => {
      await runApplyAllNewFiles({
        entries,
        applySandboxFile: options.desktopApi.applySandboxFile,
        refreshArchiveEntriesForFile: runtime.refreshArchiveEntriesForFile,
        refreshLocalProjectTree: options.refreshLocalProjectTree,
        showRemoteFilesNotice: runtime.showRemoteFilesNotice,
      });
    },
  };

  return runtime;
}
