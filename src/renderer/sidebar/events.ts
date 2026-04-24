
export type SidebarTabId = 'explorer' | 'files' | 'prompts';

export type SidebarEventsElements = {
  sidebarActivityElement: HTMLElement | null;
  projectListElement: HTMLElement | null;
};

export type SidebarActivityHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  getActiveSidebarTabId: () => SidebarTabId;
  setActiveSidebarTabId: (nextTab: SidebarTabId) => void;
  persistActiveSidebarTabId: (nextTab: SidebarTabId) => void;
  ensureFilesViewLoaded: () => void;
  render: () => void;
};

export type ProjectTreeEventHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  clearActiveTreeMenuCloseTimer: () => void;
  scheduleActiveTreeMenuClose: (delayMs?: number) => void;
  toggleTreeMenu: (projectId: string, chatId: string | null) => void;
  closeTreeMenu: () => void;
  openProjectFolder: (folderPath: string) => Promise<unknown> | void;
  showProjectProperties: (projectId: string) => void;
  showChatProperties: (projectId: string, chatId: string) => void;
  selectProject: (projectId: string) => void;
  openProject: (projectId: string) => void;
  selectChat: (projectId: string, chatId: string) => void;
  openChat: (projectId: string, chatId: string) => void;
  removeChat: (projectId: string, chatId: string) => void;
  connectProject: (projectId: string) => void;
  removeProject: (projectId: string) => void;
};

export function bindSidebarActivityEvents(
  elements: SidebarEventsElements,
  helpers: SidebarActivityHelpers,
): void {
  elements.sidebarActivityElement?.addEventListener('click', (event) => {
    const tabButton = helpers.findClosestHtmlElement(event.target, '[data-sidebar-tab]');
    if (!tabButton) {
      return;
    }

    const nextTabCandidate = tabButton.dataset.sidebarTab;
    const nextTab: SidebarTabId = nextTabCandidate === 'files' || nextTabCandidate === 'prompts' ? nextTabCandidate : 'explorer';
    if (nextTab === helpers.getActiveSidebarTabId()) {
      return;
    }

    helpers.setActiveSidebarTabId(nextTab);
    helpers.persistActiveSidebarTabId(nextTab);
    if (nextTab === 'files') {
      helpers.ensureFilesViewLoaded();
    }
    helpers.render();
  });
}

export function bindProjectTreeEvents(
  elements: SidebarEventsElements,
  helpers: ProjectTreeEventHelpers,
): void {
  elements.projectListElement?.addEventListener('click', (event) => {
    const actionElement = helpers.findClosestHtmlElement(event.target, '[data-action]');
    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;
    if (action !== 'toggle-tree-menu') {
      helpers.clearActiveTreeMenuCloseTimer();
      helpers.closeTreeMenu();
    }

    if (action === 'toggle-tree-menu') {
      const projectId = actionElement.dataset.projectId ?? '';
      const chatId = actionElement.dataset.chatId ?? '';
      if (projectId) {
        helpers.toggleTreeMenu(projectId, chatId || null);
      }
      return;
    }

    if (action === 'open-project-folder') {
      const folderPath = actionElement.dataset.folderPath ?? '';
      if (folderPath) {
        void helpers.openProjectFolder(folderPath);
      }
      return;
    }

    if (action === 'show-project-properties') {
      const projectId = actionElement.dataset.projectId ?? '';
      if (projectId) {
        helpers.showProjectProperties(projectId);
      }
      return;
    }

    if (action === 'show-chat-properties') {
      const projectId = actionElement.dataset.projectId ?? '';
      const chatId = actionElement.dataset.chatId ?? '';
      if (projectId && chatId) {
        helpers.showChatProperties(projectId, chatId);
      }
      return;
    }

    if (action === 'select-project') {
      const projectId = actionElement.dataset.projectId ?? '';
      if (projectId) {
        helpers.selectProject(projectId);
      }
      return;
    }

    if (action === 'open-project') {
      const projectId = actionElement.dataset.projectId ?? '';
      if (projectId) {
        helpers.openProject(projectId);
      }
      return;
    }

    if (action === 'select-chat') {
      const projectId = actionElement.dataset.projectId ?? '';
      const chatId = actionElement.dataset.chatId ?? '';
      if (projectId && chatId) {
        helpers.selectChat(projectId, chatId);
      }
      return;
    }

    if (action === 'open-chat') {
      const projectId = actionElement.dataset.projectId ?? '';
      const chatId = actionElement.dataset.chatId ?? '';
      if (projectId && chatId) {
        helpers.openChat(projectId, chatId);
      }
      return;
    }

    if (action === 'remove-chat') {
      const projectId = actionElement.dataset.projectId ?? '';
      const chatId = actionElement.dataset.chatId ?? '';
      if (projectId && chatId) {
        helpers.removeChat(projectId, chatId);
      }
      return;
    }

    if (action === 'connect-project') {
      const projectId = actionElement.dataset.projectId ?? '';
      if (projectId) {
        helpers.connectProject(projectId);
      }
      return;
    }

    if (action === 'remove-project') {
      const projectId = actionElement.dataset.projectId ?? '';
      if (projectId) {
        helpers.removeProject(projectId);
      }
    }
  });

  elements.projectListElement?.addEventListener('mouseover', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.tree-row__menu')) {
      return;
    }

    helpers.clearActiveTreeMenuCloseTimer();
  });

  elements.projectListElement?.addEventListener('mouseout', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const menu = target.closest('.tree-row__menu');
    if (!menu) {
      return;
    }

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && menu.contains(relatedTarget)) {
      return;
    }

    helpers.scheduleActiveTreeMenuClose(5000);
  });
}
