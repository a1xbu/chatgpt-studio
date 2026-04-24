import type { AppStateSnapshot, ProjectChatRecord, SidebarProject } from '../../shared/contracts';

export function getAllSidebarProjects(state: AppStateSnapshot): SidebarProject[] {
  return [...state.temporaryProjects, ...state.persistentProjects];
}

export function findSidebarProject(state: AppStateSnapshot, projectId: string): SidebarProject | null {
  return getAllSidebarProjects(state).find((project) => project.projectId === projectId) ?? null;
}

export function findPersistentSidebarProject(state: AppStateSnapshot, projectId: string): SidebarProject | null {
  return state.persistentProjects.find((project) => project.projectId === projectId) ?? null;
}

export function findSidebarChat(state: AppStateSnapshot, projectId: string, chatId: string): ProjectChatRecord | null {
  return findSidebarProject(state, projectId)?.chats.find((chat) => chat.chatId === chatId) ?? null;
}

export function resolveSidebarProjectFolderPath(state: AppStateSnapshot, projectId: string): string | null {
  return findSidebarProject(state, projectId)?.folderPath ?? null;
}

export type EnsureExpandedProjectsOptions = {
  state: AppStateSnapshot;
  expandedProjectIds: Set<string>;
  lastAutoExpandedProjectId: string | null;
};

export type EnsureExpandedProjectsResult = {
  expandedProjectIds: Set<string>;
  lastAutoExpandedProjectId: string | null;
  didChange: boolean;
};

export function ensureExpandedProjects(options: EnsureExpandedProjectsOptions): EnsureExpandedProjectsResult {
  const currentProjectId = options.state.lastContext?.currentProjectId ?? options.state.temporaryProjects[0]?.projectId ?? null;
  if (!currentProjectId) {
    return {
      expandedProjectIds: options.expandedProjectIds,
      lastAutoExpandedProjectId: null,
      didChange: options.lastAutoExpandedProjectId !== null,
    };
  }

  if (options.lastAutoExpandedProjectId === currentProjectId && options.expandedProjectIds.has(currentProjectId)) {
    return {
      expandedProjectIds: options.expandedProjectIds,
      lastAutoExpandedProjectId: options.lastAutoExpandedProjectId,
      didChange: false,
    };
  }

  return {
    expandedProjectIds: new Set([currentProjectId]),
    lastAutoExpandedProjectId: currentProjectId,
    didChange: true,
  };
}
