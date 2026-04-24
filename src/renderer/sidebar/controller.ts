import type { AppStateSnapshot, ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import type { ProjectTreeEventHelpers, SidebarActivityHelpers } from './events';
import type { SidebarSelection, TreeMenuState } from './types';

export type SidebarActivityControllerOptions = {
  findClosestHtmlElement: SidebarActivityHelpers['findClosestHtmlElement'];
  getActiveSidebarTabId: SidebarActivityHelpers['getActiveSidebarTabId'];
  setActiveSidebarTabId: SidebarActivityHelpers['setActiveSidebarTabId'];
  persistActiveSidebarTabId: SidebarActivityHelpers['persistActiveSidebarTabId'];
  ensureFilesViewLoaded: SidebarActivityHelpers['ensureFilesViewLoaded'];
  render: SidebarActivityHelpers['render'];
};

export function createSidebarActivityHelpers(options: SidebarActivityControllerOptions): SidebarActivityHelpers {
  return {
    findClosestHtmlElement: options.findClosestHtmlElement,
    getActiveSidebarTabId: options.getActiveSidebarTabId,
    setActiveSidebarTabId: options.setActiveSidebarTabId,
    persistActiveSidebarTabId: options.persistActiveSidebarTabId,
    ensureFilesViewLoaded: options.ensureFilesViewLoaded,
    render: options.render,
  };
}

export type ProjectTreeControllerOptions = {
  findClosestHtmlElement: ProjectTreeEventHelpers['findClosestHtmlElement'];
  clearActiveTreeMenuCloseTimer: ProjectTreeEventHelpers['clearActiveTreeMenuCloseTimer'];
  scheduleActiveTreeMenuClose: ProjectTreeEventHelpers['scheduleActiveTreeMenuClose'];
  getActiveTreeMenu: () => TreeMenuState | null;
  setActiveTreeMenu: (state: TreeMenuState | null) => void;
  getTreeMenuKey: (state: TreeMenuState | null) => string;
  render: () => void;
  openProjectFolder: (folderPath: string) => Promise<unknown> | void;
  setPropertiesDialogProject: (projectId: string) => void;
  setPropertiesDialogChat: (projectId: string, chatId: string) => void;
  setSelectedSidebarItem: (selection: SidebarSelection) => void;
  expandedProjectIds: Set<string>;
  persistExpandedProjectIds: () => void;
  getCurrentState: () => AppStateSnapshot | null;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  setBrowserOpenedSidebarItem: (selection: SidebarSelection) => void;
  persistBrowserOpenedSelection: () => void;
  openBrowserUrl: (url: string) => void;
  resolveProjectBrowserUrl: (project: SidebarProject) => string;
  resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
  openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => Promise<void>;
  getChatEditorTabId: (projectId: string, chatId: string) => string;
  hasEditorTab: (tabId: string) => boolean;
  closeEditorTab: (tabId: string) => void;
  removeChat: (projectId: string, chatId: string) => Promise<boolean>;
  connectProject: (projectId: string) => Promise<unknown>;
  removeProject: (projectId: string) => Promise<unknown>;
  confirm: (message: string) => boolean;
  alert: (message: string) => void;
};

export function createProjectTreeEventHelpers(options: ProjectTreeControllerOptions): ProjectTreeEventHelpers {
  return {
    findClosestHtmlElement: options.findClosestHtmlElement,
    clearActiveTreeMenuCloseTimer: options.clearActiveTreeMenuCloseTimer,
    scheduleActiveTreeMenuClose: options.scheduleActiveTreeMenuClose,
    toggleTreeMenu: (projectId, chatId) => {
      const nextMenu: TreeMenuState = chatId
        ? { kind: 'chat', projectId, chatId }
        : { kind: 'project', projectId };
      const currentMenu = options.getActiveTreeMenu();
      options.setActiveTreeMenu(options.getTreeMenuKey(currentMenu) === options.getTreeMenuKey(nextMenu) ? null : nextMenu);
      options.clearActiveTreeMenuCloseTimer();
      options.render();
    },
    closeTreeMenu: () => {
      options.setActiveTreeMenu(null);
    },
    openProjectFolder: options.openProjectFolder,
    showProjectProperties: (projectId) => {
      options.setPropertiesDialogProject(projectId);
      options.render();
    },
    showChatProperties: (projectId, chatId) => {
      options.setPropertiesDialogChat(projectId, chatId);
      options.render();
    },
    selectProject: (projectId) => {
      options.setSelectedSidebarItem({ kind: 'project', projectId });
      if (options.expandedProjectIds.has(projectId)) {
        options.expandedProjectIds.delete(projectId);
      } else {
        options.expandedProjectIds.add(projectId);
      }
      options.persistExpandedProjectIds();
      options.render();
    },
    openProject: (projectId) => {
      const currentState = options.getCurrentState();
      if (!currentState) {
        return;
      }
      const project = options.findSidebarProject(currentState, projectId);
      if (!project) {
        return;
      }
      const selection: SidebarSelection = { kind: 'project', projectId };
      options.setSelectedSidebarItem(selection);
      options.setBrowserOpenedSidebarItem(selection);
      options.persistBrowserOpenedSelection();
      options.render();
      options.openBrowserUrl(options.resolveProjectBrowserUrl(project));
    },
    selectChat: (projectId, chatId) => {
      const currentState = options.getCurrentState();
      if (!currentState) {
        return;
      }
      const project = options.findSidebarProject(currentState, projectId);
      const chat = project ? options.findSidebarChat(currentState, projectId, chatId) : null;
      if (!project || !chat) {
        return;
      }
      options.setSelectedSidebarItem({ kind: 'chat', projectId, chatId });
      options.render();
      void options.openChatHistoryTab(project, chat).catch((error: unknown) => {
        options.alert(error instanceof Error ? error.message : String(error));
      });
    },
    openChat: (projectId, chatId) => {
      const currentState = options.getCurrentState();
      if (!currentState) {
        return;
      }
      const project = options.findSidebarProject(currentState, projectId);
      const chat = project ? options.findSidebarChat(currentState, projectId, chatId) : null;
      if (!project || !chat) {
        return;
      }
      const selection: SidebarSelection = { kind: 'chat', projectId, chatId };
      options.setSelectedSidebarItem(selection);
      options.setBrowserOpenedSidebarItem(selection);
      options.persistBrowserOpenedSelection();
      options.render();
      options.openBrowserUrl(options.resolveChatBrowserUrl(project, chat));
    },
    removeChat: (projectId, chatId) => {
      options.render();
      const currentState = options.getCurrentState();
      if (!currentState) {
        return;
      }
      const project = options.findSidebarProject(currentState, projectId);
      const chat = project ? options.findSidebarChat(currentState, projectId, chatId) : null;
      const chatName = chat?.chatName ?? chatId;
      const confirmed = options.confirm(
        `Remove local chat "${chatName}"?\n\nThis removes the captured chat, files, and local history for this chat only.`,
      );
      if (!confirmed) {
        return;
      }
      void options.removeChat(projectId, chatId).then((removed) => {
        if (!removed) {
          return;
        }
        const tabId = options.getChatEditorTabId(projectId, chatId);
        if (options.hasEditorTab(tabId)) {
          options.closeEditorTab(tabId);
        }
      }).catch((error: unknown) => {
        options.alert(error instanceof Error ? error.message : String(error));
      });
    },
    connectProject: (projectId) => {
      options.render();
      void options.connectProject(projectId).catch((error: unknown) => {
        options.alert(error instanceof Error ? error.message : String(error));
      });
    },
    removeProject: (projectId) => {
      options.render();
      const currentState = options.getCurrentState();
      const project = currentState ? options.findSidebarProject(currentState, projectId) : null;
      const projectName = project?.projectName ?? projectId;
      const confirmed = options.confirm(
        `Remove "${projectName}" from local storage?\n\nThis only removes the local project binding. Files on disk will stay untouched.`,
      );
      if (!confirmed) {
        return;
      }
      void options.removeProject(projectId).catch((error: unknown) => {
        options.alert(error instanceof Error ? error.message : String(error));
      });
    },
  };
}
