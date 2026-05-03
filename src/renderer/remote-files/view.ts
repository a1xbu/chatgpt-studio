import type { AppStateSnapshot, ChatFileRecord, SidebarProject } from '../../shared/contracts';
import { getRemoteFileArchiveBranchKey, getRemoteFileRootKey, renderRemoteFilesPanelMarkup } from './panel';
import type { RemoteFilesDownloadRuntimeState, RemoteFilesPanelEntry, RemoteFilesPanelHelpers } from './panel';

export type RendererRemoteFilesEntry = {
  project: SidebarProject;
  file: ChatFileRecord;
};

export type RemoteFilesPanelViewOptions = {
  state: AppStateSnapshot;
  newFilesPanelElement: HTMLElement | null;
  newFilesPanelResizerElement: HTMLElement | null;
  isNewFilesCollapsed: boolean;
  setIsNewFilesCollapsed: (value: boolean) => void;
  persistCollapsedState: (value: boolean) => void;
  getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
  getLatestEntries: (state: AppStateSnapshot) => RendererRemoteFilesEntry[];
  syncNewFilesCollapsedState: (entries: RendererRemoteFilesEntry[]) => void;
  ensureArchiveEntriesForVisibleNewFiles: (entries: RendererRemoteFilesEntry[]) => void;
  ensureNewFilesPanelHeight: () => void;
  downloadAutomatically: boolean;
  remoteFilesNotice: { message: string; tone: 'info' | 'success' | 'error' } | null;
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  renderApplyIcon: () => string;
  renderArchiveIcon: () => string;
  renderGitBranchIcon: () => string;
  renderBusyIcon: () => string;
  renderCheckIcon: () => string;
  renderChevronIcon: () => string;
  renderDownloadArrowIcon: () => string;
  renderMoreActionsIcon: () => string;
  renderFileTreeFileIcon: () => string;
  renderFolderTreeIcon: RemoteFilesPanelHelpers['renderFolderTreeIcon'];
  getChatFileKey: RemoteFilesPanelHelpers['getChatFileKey'];
  getSandboxFileBaseName: RemoteFilesPanelHelpers['getSandboxFileBaseName'];
  getEffectiveDownloadPath: RemoteFilesPanelHelpers['getEffectiveDownloadPath'];
  getDownloadRuntimeStatus: (file: RemoteFilesPanelEntry['file']) => RemoteFilesDownloadRuntimeState;
  getArchiveEntriesForFile: RemoteFilesPanelHelpers['getArchiveEntriesForFile'];
  expandedNewFilesKeys: Set<string>;
};

export function renderRemoteFilesPanel(options: RemoteFilesPanelViewOptions): void {
  if (!options.newFilesPanelElement) {
    return;
  }

  const activeProject = options.getActiveSidebarProject(options.state);
  if (!activeProject) {
    options.setIsNewFilesCollapsed(true);
    options.persistCollapsedState(true);
    options.newFilesPanelElement.classList.remove('new-files-panel--visible', 'new-files-panel--collapsed');
    options.newFilesPanelElement.innerHTML = '';
    options.newFilesPanelResizerElement?.classList.remove('new-files-panel-resizer--visible');
    return;
  }

  const entries = options.getLatestEntries(options.state)
    .sort((left, right) => Date.parse(right.file.updatedAt) - Date.parse(left.file.updatedAt))
    .slice(0, 12);
  options.syncNewFilesCollapsedState(entries);

  if (!entries.length) {
    options.newFilesPanelElement.classList.remove('new-files-panel--visible', 'new-files-panel--collapsed');
    options.newFilesPanelElement.innerHTML = '';
    options.newFilesPanelResizerElement?.classList.remove('new-files-panel-resizer--visible');
    return;
  }

  options.ensureArchiveEntriesForVisibleNewFiles(entries);
  options.ensureNewFilesPanelHeight();

  options.newFilesPanelResizerElement?.classList.add('new-files-panel-resizer--visible');
  options.newFilesPanelElement.classList.add('new-files-panel--visible');
  options.newFilesPanelElement.classList.toggle('new-files-panel--collapsed', options.isNewFilesCollapsed);
  options.newFilesPanelElement.innerHTML = renderRemoteFilesPanelMarkup(
    {
      entries,
      isCollapsed: options.isNewFilesCollapsed,
      downloadAutomatically: options.downloadAutomatically,
      notice: options.remoteFilesNotice,
    },
    {
      escapeHtml: options.escapeHtml,
      formatTimestamp: options.formatTimestamp,
      renderApplyIcon: options.renderApplyIcon,
      renderArchiveIcon: options.renderArchiveIcon,
      renderGitBranchIcon: options.renderGitBranchIcon,
      renderBusyIcon: options.renderBusyIcon,
      renderCheckIcon: options.renderCheckIcon,
      renderChevronIcon: options.renderChevronIcon,
      renderDownloadArrowIcon: options.renderDownloadArrowIcon,
      renderMoreActionsIcon: options.renderMoreActionsIcon,
      renderFileTreeFileIcon: options.renderFileTreeFileIcon,
      renderFolderTreeIcon: options.renderFolderTreeIcon,
      getChatFileKey: options.getChatFileKey,
      getSandboxFileBaseName: options.getSandboxFileBaseName,
      getEffectiveDownloadPath: options.getEffectiveDownloadPath,
      getDownloadRuntimeStatus: options.getDownloadRuntimeStatus,
      getArchiveEntriesForFile: options.getArchiveEntriesForFile,
      isRootExpanded: (file) => options.expandedNewFilesKeys.has(getRemoteFileRootKey(file, options.getChatFileKey)),
      isArchiveDirectoryExpanded: (file, relativePath) => options.expandedNewFilesKeys.has(getRemoteFileArchiveBranchKey(file, options.getChatFileKey, relativePath)),
    },
  );
}
