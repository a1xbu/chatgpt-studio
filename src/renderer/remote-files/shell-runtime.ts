import type { ChatFileRecord, SidebarProject } from '../../shared/contracts';
import type { RendererRemoteFilesStoreSlice, RendererWorkspaceStoreSlice } from '../app/store';
import type { RendererRemoteFilesBindingsSlice } from '../bootstrap/renderer-context';
import { getRemoteFileArchiveBranchKey, getRemoteFileRootKey } from './panel';
import type { RendererRemoteFilesRuntime } from './runtime';

export type CreateRendererRemoteFilesBindingsSliceArgs = {
  workspaceState: RendererWorkspaceStoreSlice;
  remoteFilesState: RendererRemoteFilesStoreSlice;
  storage: Storage;
  storageKeys: {
    newFilesCollapsed: string;
    downloadAutomatically: string;
  };
  remoteFilesRuntime: Pick<RendererRemoteFilesRuntime,
    'showRemoteFilesNotice' |
    'runApplySandboxFile' |
    'runApplyAllNewFiles' |
    'loadArchiveEntriesForFile' |
    'getEffectiveDownloadPath'
  >;
  getLatestEntries: () => Array<{ project: SidebarProject; file: ChatFileRecord }>;
  findLatestNewFileByKey: (fileKey: string) => { project: SidebarProject; file: ChatFileRecord } | null;
  getChatFileKey: (file: Pick<ChatFileRecord, 'chatId' | 'messageId' | 'sandboxPath'>) => string;
  shouldWarnBeforeApplyingArchive: (file: ChatFileRecord) => boolean;
  createIsoTimestamp: () => string;
};

export function createRendererRemoteFilesBindingsSlice(
  args: CreateRendererRemoteFilesBindingsSliceArgs,
): RendererRemoteFilesBindingsSlice {
  return {
    state: {
      setDownloadAutomatically: (checked) => {
        args.remoteFilesState.downloadAutomatically = checked;
      },
    },
    actions: {
      showRemoteFilesNotice: args.remoteFilesRuntime.showRemoteFilesNotice,
      findLatestNewFileByKey: args.findLatestNewFileByKey,
      getLatestEntries: args.getLatestEntries,
      findLatestEntryByKey: args.findLatestNewFileByKey,
      runApplySandboxFile: (file, relativePath) => args.remoteFilesRuntime.runApplySandboxFile(file, relativePath),
      toggleNewFilesCollapsed: () => {
        args.workspaceState.isNewFilesCollapsed = !args.workspaceState.isNewFilesCollapsed;
        args.storage.setItem(args.storageKeys.newFilesCollapsed, String(args.workspaceState.isNewFilesCollapsed));
      },
      runApplyAllNewFiles: (entries) => args.remoteFilesRuntime.runApplyAllNewFiles(entries),
      getRemoteFileRootKey: (file) => getRemoteFileRootKey(file, args.getChatFileKey),
      getRemoteFileArchiveBranchKey: (file, relativePath) => getRemoteFileArchiveBranchKey(file, args.getChatFileKey, relativePath),
      loadArchiveEntriesForFile: (file) => args.remoteFilesRuntime.loadArchiveEntriesForFile(file),
      shouldWarnBeforeApplyingArchive: args.shouldWarnBeforeApplyingArchive,
      persistDownloadAutomatically: (checked) => {
        args.storage.setItem(args.storageKeys.downloadAutomatically, String(checked));
      },
      getEffectiveDownloadPath: args.remoteFilesRuntime.getEffectiveDownloadPath,
      newIsoTimestamp: args.createIsoTimestamp,
    },
  };
}
