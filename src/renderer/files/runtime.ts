import type {
  AppStateSnapshot,
  ApplySandboxFileResult,
  ChatFileArchiveEntryRecord,
  ChatFileRecord,
  SidebarProject,
} from '../../shared/contracts';
import type { LocalProjectFileEntry } from '../desktop-api';
import type { FileDownloadRuntimeStatus } from '../runtime-types';
import type { SidebarSelection } from '../sidebar/types';
import { getAllSidebarFiles, getChatFileKey, getLatestNewFiles } from './discovery';
import { formatUpdatedFilesMessage, isZipLikeRemoteFile } from '../remote-files/panel';

export type FindLatestNewFileByKeyOptions = {
  currentState: AppStateSnapshot | null;
  selectedSidebarItem: SidebarSelection | null;
  fileKey: string;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
};

export type LocalFilesCaches = {
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  localFileErrorsByKey: Map<string, string>;
  localFileLoadingKeys: Set<string>;
};

export type ArchiveEntryCaches = {
  archiveEntriesByFileKey: Map<string, ChatFileArchiveEntryRecord[]>;
  archiveEntryErrorsByFileKey: Map<string, string>;
  archiveEntryLoadingKeys: Set<string>;
};

export function findLatestNewFileByKey(
  options: FindLatestNewFileByKeyOptions,
): { project: SidebarProject; file: ChatFileRecord } | null {
  if (!options.currentState) {
    return null;
  }

  return getLatestNewFiles(options.getAllSidebarProjects(options.currentState), options.selectedSidebarItem)
    .find(({ file }) => getChatFileKey(file) === options.fileKey) ?? null;
}

export function clearLocalFileTreeCache(projectId: string, caches: LocalFilesCaches): void {
  for (const key of [...caches.localFileEntriesByKey.keys()]) {
    if (key.startsWith(`${projectId}::`)) {
      caches.localFileEntriesByKey.delete(key);
    }
  }

  for (const key of [...caches.localFileErrorsByKey.keys()]) {
    if (key.startsWith(`${projectId}::`)) {
      caches.localFileErrorsByKey.delete(key);
    }
  }

  for (const key of [...caches.localFileLoadingKeys]) {
    if (key.startsWith(`${projectId}::`)) {
      caches.localFileLoadingKeys.delete(key);
    }
  }
}

export function clearArchiveEntriesCacheForProject(options: {
  projectId: string;
  currentState: AppStateSnapshot | null;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
} & ArchiveEntryCaches): void {
  if (!options.currentState) {
    return;
  }

  const relatedFiles = getAllSidebarFiles(options.getAllSidebarProjects(options.currentState))
    .filter(({ file }) => file.projectId === options.projectId)
    .map(({ file }) => getChatFileKey(file));
  for (const fileKey of relatedFiles) {
    options.archiveEntriesByFileKey.delete(fileKey);
    options.archiveEntryErrorsByFileKey.delete(fileKey);
    options.archiveEntryLoadingKeys.delete(fileKey);
  }
}

export function getEffectiveDownloadPath(
  file: ChatFileRecord,
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>,
): string | null {
  const runtime = fileDownloadStatuses.get(getChatFileKey(file)) ?? null;
  return file.downloadPath ?? runtime?.downloadPath ?? null;
}

export async function loadArchiveEntriesForFile(options: {
  file: ChatFileRecord;
  render: () => void;
  listSandboxFileArchiveEntries: (projectId: string, chatId: string, messageId: string, sandboxPath: string) => Promise<ChatFileArchiveEntryRecord[]>;
} & ArchiveEntryCaches): Promise<void> {
  const fileKey = getChatFileKey(options.file);
  if (options.archiveEntriesByFileKey.has(fileKey) || options.archiveEntryLoadingKeys.has(fileKey)) {
    return;
  }

  options.archiveEntryLoadingKeys.add(fileKey);
  options.archiveEntryErrorsByFileKey.delete(fileKey);
  options.render();

  try {
    const entries = await options.listSandboxFileArchiveEntries(
      options.file.projectId,
      options.file.chatId,
      options.file.messageId,
      options.file.sandboxPath,
    );
    options.archiveEntriesByFileKey.set(fileKey, entries);
  } catch (error) {
    options.archiveEntryErrorsByFileKey.set(fileKey, error instanceof Error ? error.message : String(error));
  } finally {
    options.archiveEntryLoadingKeys.delete(fileKey);
    options.render();
  }
}

export function refreshArchiveEntriesForFile(options: {
  file: Pick<ChatFileRecord, 'projectId' | 'chatId' | 'messageId' | 'sandboxPath'>;
  currentState: AppStateSnapshot | null;
  selectedSidebarItem: SidebarSelection | null;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  loadArchiveEntriesForFile: (file: ChatFileRecord) => Promise<void>;
} & ArchiveEntryCaches): void {
  const fileKey = getChatFileKey(options.file);
  options.archiveEntriesByFileKey.delete(fileKey);
  options.archiveEntryErrorsByFileKey.delete(fileKey);
  options.archiveEntryLoadingKeys.delete(fileKey);

  const latest = findLatestNewFileByKey({
    currentState: options.currentState,
    selectedSidebarItem: options.selectedSidebarItem,
    fileKey,
    getAllSidebarProjects: options.getAllSidebarProjects,
  });
  if (
    latest
    && isZipLikeRemoteFile(latest.file)
    && (latest.file.archiveEntryCount ?? 0) > 0
    && getEffectiveDownloadPath(latest.file, options.fileDownloadStatuses)
  ) {
    void options.loadArchiveEntriesForFile(latest.file);
  }
}

export function ensureArchiveEntriesForVisibleNewFiles(options: {
  entries: Array<{ project: SidebarProject; file: ChatFileRecord }>;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  loadArchiveEntriesForFile: (file: ChatFileRecord) => Promise<void>;
}): void {
  for (const { file } of options.entries) {
    if (!isZipLikeRemoteFile(file)) {
      continue;
    }

    if (!getEffectiveDownloadPath(file, options.fileDownloadStatuses)) {
      continue;
    }

    if ((file.archiveEntryCount ?? 0) <= 0) {
      continue;
    }

    void options.loadArchiveEntriesForFile(file);
  }
}

export function showRemoteFilesNotice(options: {
  message: string;
  tone?: 'info' | 'success' | 'error';
  setNotice: (notice: { message: string; tone: 'info' | 'success' | 'error' } | null) => void;
  getNoticeTimer: () => number | null;
  setNoticeTimer: (timerId: number | null) => void;
  clearTimeoutImpl: (timerId: number) => void;
  setTimeoutImpl: (callback: () => void, delayMs: number) => number;
  render: () => void;
}): void {
  const tone = options.tone ?? 'success';
  options.setNotice({ message: options.message, tone });
  const existingTimer = options.getNoticeTimer();
  if (existingTimer != null) {
    options.clearTimeoutImpl(existingTimer);
  }

  options.setNoticeTimer(options.setTimeoutImpl(() => {
    options.setNotice(null);
    options.setNoticeTimer(null);
    options.render();
  }, 3200));
  options.render();
}

export function getRemoteManifestPrompt(
  remoteManifestPrompt: string,
  projectId: string,
): string {
  return remoteManifestPrompt.replace('<required-current-project-id>', projectId || '<project-id>');
}

export function shouldWarnBeforeApplyingArchive(file: ChatFileRecord): boolean {
  return isZipLikeRemoteFile(file);
}

export async function runApplySandboxFile(options: {
  file: ChatFileRecord;
  relativePath?: string | null;
  applySandboxFile: (projectId: string, chatId: string, messageId: string, sandboxPath: string, relativePath?: string | null) => Promise<ApplySandboxFileResult>;
  refreshArchiveEntriesForFile: (file: ChatFileRecord) => void;
  refreshLocalProjectTree: (projectId: string) => void;
  showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}): Promise<ApplySandboxFileResult> {
  const result = await options.applySandboxFile(
    options.file.projectId,
    options.file.chatId,
    options.file.messageId,
    options.file.sandboxPath,
    options.relativePath,
  );
  options.refreshArchiveEntriesForFile(options.file);
  options.refreshLocalProjectTree(options.file.projectId);
  options.showRemoteFilesNotice(formatUpdatedFilesMessage(result.updatedFileCount, result.message));
  return result;
}

export async function runApplyAllNewFiles(options: {
  entries: Array<{ project: SidebarProject; file: ChatFileRecord }>;
  applySandboxFile: (projectId: string, chatId: string, messageId: string, sandboxPath: string) => Promise<ApplySandboxFileResult>;
  refreshArchiveEntriesForFile: (file: ChatFileRecord) => void;
  refreshLocalProjectTree: (projectId: string) => void;
  showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}): Promise<void> {
  let updatedFileCount = 0;
  for (const { file } of options.entries) {
    if (shouldWarnBeforeApplyingArchive(file)) {
      continue;
    }
    const result = await options.applySandboxFile(file.projectId, file.chatId, file.messageId, file.sandboxPath);
    updatedFileCount += result.updatedFileCount;
    options.refreshArchiveEntriesForFile(file);
  }

  if (options.entries[0]) {
    options.refreshLocalProjectTree(options.entries[0].file.projectId);
  }
  options.showRemoteFilesNotice(formatUpdatedFilesMessage(updatedFileCount));
}

export function refreshLocalProjectTree(options: {
  projectId: string;
  clearLocalFileTreeCache: (projectId: string) => void;
  clearArchiveEntriesCacheForProject: (projectId: string) => void;
  loadLocalFileTree: (projectId: string, relativePath?: string) => Promise<void>;
}): void {
  options.clearLocalFileTreeCache(options.projectId);
  options.clearArchiveEntriesCacheForProject(options.projectId);
  void options.loadLocalFileTree(options.projectId, '');
}

export function syncProjectFileSignatures(options: {
  state: AppStateSnapshot;
  projectFileSignatures: Map<string, string>;
  clearLocalFileTreeCache: (projectId: string) => void;
  clearArchiveEntriesCacheForProject: (projectId: string) => void;
}): void {
  const nextProjectIds = new Set<string>();
  for (const project of [...options.state.persistentProjects, ...options.state.temporaryProjects]) {
    nextProjectIds.add(project.projectId);
    const signature = project.files
      .map((file) => `${getChatFileKey(file)}::${file.downloadPath ?? ''}::${file.appliedAt ?? ''}::${file.updatedAt}`)
      .sort()
      .join('|');
    const previousSignature = options.projectFileSignatures.get(project.projectId) ?? null;
    if (previousSignature !== null && previousSignature !== signature) {
      options.clearLocalFileTreeCache(project.projectId);
      options.clearArchiveEntriesCacheForProject(project.projectId);
    }
    options.projectFileSignatures.set(project.projectId, signature);
  }

  for (const projectId of [...options.projectFileSignatures.keys()]) {
    if (!nextProjectIds.has(projectId)) {
      options.projectFileSignatures.delete(projectId);
    }
  }
}

export function getLocalFileTreeKey(projectId: string, relativePath = ''): string {
  return `${projectId}::${relativePath}`;
}

export function getLocalFileTreeDepth(relativePath: string): number {
  return relativePath ? relativePath.split('/').filter(Boolean).length : 0;
}

export function getLocalFileTreeChildren(
  projectId: string,
  relativePath = '',
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>,
): LocalProjectFileEntry[] {
  return localFileEntriesByKey.get(getLocalFileTreeKey(projectId, relativePath)) ?? [];
}

export function getNewFilesSignature(entries: Array<{ project: SidebarProject; file: ChatFileRecord }>): string {
  return entries
    .map(({ file }) => `${getChatFileKey(file)}::${file.updatedAt}::${file.downloadPath ?? ''}`)
    .sort()
    .join('|');
}

export function syncNewFilesCollapsedState(options: {
  entries: Array<{ project: SidebarProject; file: ChatFileRecord }>;
  lastNewFilesSignature: string;
  setLastNewFilesSignature: (value: string) => void;
  setIsNewFilesCollapsed: (value: boolean) => void;
  persistCollapsedState: (value: boolean) => void;
}): void {
  const nextSignature = getNewFilesSignature(options.entries);
  if (options.entries.length && nextSignature && nextSignature !== options.lastNewFilesSignature) {
    options.setIsNewFilesCollapsed(false);
    options.persistCollapsedState(false);
  }

  options.setLastNewFilesSignature(nextSignature);
}

export async function loadLocalFileTree(options: {
  projectId: string;
  relativePath?: string;
  currentState: AppStateSnapshot | null;
  getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
  renderFileViewPanel: (state: AppStateSnapshot, preserveScroll: boolean) => void;
  listProjectFiles: (projectId: string, relativePath: string | null) => Promise<LocalProjectFileEntry[]>;
} & LocalFilesCaches): Promise<void> {
  const relativePath = options.relativePath ?? '';
  const cacheKey = getLocalFileTreeKey(options.projectId, relativePath);
  if (options.localFileLoadingKeys.has(cacheKey)) {
    return;
  }

  options.localFileLoadingKeys.add(cacheKey);
  options.localFileErrorsByKey.delete(cacheKey);
  if (options.currentState && options.getActiveSidebarProject(options.currentState)?.projectId === options.projectId) {
    options.renderFileViewPanel(options.currentState, true);
  }

  try {
    const entries = await options.listProjectFiles(options.projectId, relativePath || null);
    options.localFileEntriesByKey.set(cacheKey, entries);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.localFileErrorsByKey.set(cacheKey, message);
  } finally {
    options.localFileLoadingKeys.delete(cacheKey);
    if (options.currentState && options.getActiveSidebarProject(options.currentState)?.projectId === options.projectId) {
      options.renderFileViewPanel(options.currentState, true);
    }
  }
}

export function ensureLocalFileTreeForState(options: {
  state: AppStateSnapshot;
  getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  localFileLoadingKeys: Set<string>;
  loadLocalFileTree: (projectId: string, relativePath?: string) => Promise<void>;
}): void {
  const project = options.getActiveSidebarProject(options.state);
  if (!project?.folderPath) {
    return;
  }

  const rootKey = getLocalFileTreeKey(project.projectId, '');
  if (!options.localFileEntriesByKey.has(rootKey) && !options.localFileLoadingKeys.has(rootKey)) {
    void options.loadLocalFileTree(project.projectId, '');
  }
}
