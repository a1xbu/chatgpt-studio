import type {
  AppStateSnapshot,
  ChatFileArchiveEntryRecord,
  SidebarProject,
} from '../../shared/contracts';
import type { LocalProjectFileEntry } from '../desktop-api';
import {
  clearArchiveEntriesCacheForProject as clearArchiveEntriesCacheForProjectImpl,
  clearLocalFileTreeCache as clearLocalFileTreeCacheImpl,
  ensureLocalFileTreeForState as ensureLocalFileTreeForStateImpl,
  loadLocalFileTree as loadLocalFileTreeImpl,
  refreshLocalProjectTree as refreshLocalProjectTreeImpl,
  syncProjectFileSignatures as syncProjectFileSignaturesImpl,
} from './runtime';
import type { FilesSelectorDependencies } from './selectors';

export type FilesActionDependencies = FilesSelectorDependencies & {
  getCurrentState: () => AppStateSnapshot | null;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  projectFileSignatures: Map<string, string>;
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  localFileErrorsByKey: Map<string, string>;
  localFileLoadingKeys: Set<string>;
  archiveEntriesByFileKey: Map<string, ChatFileArchiveEntryRecord[]>;
  archiveEntryErrorsByFileKey: Map<string, string>;
  archiveEntryLoadingKeys: Set<string>;
};

export type FilesLoadLocalFileTreeDependencies = FilesActionDependencies & {
  renderFileViewPanel: (state: AppStateSnapshot, preserveScroll?: boolean) => void;
  listProjectFiles: (projectId: string, relativePath: string | null) => Promise<LocalProjectFileEntry[]>;
};

export type FilesEnsureLocalFileTreeDependencies = FilesActionDependencies & {
  loadLocalFileTree: (projectId: string, relativePath?: string) => Promise<void>;
};

export function clearLocalFileTreeCache(
  projectId: string,
  dependencies: FilesActionDependencies,
): void {
  clearLocalFileTreeCacheImpl(projectId, {
    localFileEntriesByKey: dependencies.localFileEntriesByKey,
    localFileErrorsByKey: dependencies.localFileErrorsByKey,
    localFileLoadingKeys: dependencies.localFileLoadingKeys,
  });
}

export function clearArchiveEntriesCacheForProject(
  projectId: string,
  dependencies: FilesActionDependencies,
): void {
  clearArchiveEntriesCacheForProjectImpl({
    projectId,
    currentState: dependencies.getCurrentState(),
    getAllSidebarProjects: dependencies.getAllSidebarProjects,
    archiveEntriesByFileKey: dependencies.archiveEntriesByFileKey,
    archiveEntryErrorsByFileKey: dependencies.archiveEntryErrorsByFileKey,
    archiveEntryLoadingKeys: dependencies.archiveEntryLoadingKeys,
  });
}

export function refreshLocalProjectTree(
  projectId: string,
  dependencies: FilesEnsureLocalFileTreeDependencies,
): void {
  refreshLocalProjectTreeImpl({
    projectId,
    clearLocalFileTreeCache: (nextProjectId) => {
      clearLocalFileTreeCache(nextProjectId, dependencies);
    },
    clearArchiveEntriesCacheForProject: (nextProjectId) => {
      clearArchiveEntriesCacheForProject(nextProjectId, dependencies);
    },
    loadLocalFileTree: dependencies.loadLocalFileTree,
  });
}

export function syncProjectFileSignatures(
  state: AppStateSnapshot,
  dependencies: FilesActionDependencies,
): void {
  syncProjectFileSignaturesImpl({
    state,
    projectFileSignatures: dependencies.projectFileSignatures,
    clearLocalFileTreeCache: (projectId) => {
      clearLocalFileTreeCache(projectId, dependencies);
    },
    clearArchiveEntriesCacheForProject: (projectId) => {
      clearArchiveEntriesCacheForProject(projectId, dependencies);
    },
  });
}

export async function loadLocalFileTree(
  projectId: string,
  dependencies: FilesLoadLocalFileTreeDependencies,
  relativePath = '',
): Promise<void> {
  await loadLocalFileTreeImpl({
    projectId,
    relativePath,
    currentState: dependencies.getCurrentState(),
    getActiveSidebarProject: (state) => state
      ? dependencies.findPersistentSidebarProject(state, dependencies.getSelectedSidebarItem()?.projectId ?? '')
        ?? dependencies.findSidebarProject(state, dependencies.getSelectedSidebarItem()?.projectId ?? '')
      : null,
    localFileEntriesByKey: dependencies.localFileEntriesByKey,
    localFileErrorsByKey: dependencies.localFileErrorsByKey,
    localFileLoadingKeys: dependencies.localFileLoadingKeys,
    renderFileViewPanel: dependencies.renderFileViewPanel,
    listProjectFiles: dependencies.listProjectFiles,
  });
}

export function ensureLocalFileTreeForState(
  state: AppStateSnapshot,
  dependencies: FilesEnsureLocalFileTreeDependencies,
): void {
  ensureLocalFileTreeForStateImpl({
    state,
    getActiveSidebarProject: (nextState) => dependencies.findPersistentSidebarProject(nextState, dependencies.getSelectedSidebarItem()?.projectId ?? '')
      ?? dependencies.findSidebarProject(nextState, dependencies.getSelectedSidebarItem()?.projectId ?? ''),
    localFileEntriesByKey: dependencies.localFileEntriesByKey,
    localFileLoadingKeys: dependencies.localFileLoadingKeys,
    loadLocalFileTree: dependencies.loadLocalFileTree,
  });
}
