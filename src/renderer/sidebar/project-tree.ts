export type ProjectTreeChatRecord = {
  chatId: string;
  chatName: string;
  projectId: string;
  updatedAt: string;
};

export type ProjectTreeProjectRecord = {
  projectId: string;
  projectName: string;
  status: 'temporary' | 'persistent';
  chats: ProjectTreeChatRecord[];
  lastSeenAt: string;
};

export type ProjectTreeSelection =
  | {
      kind: 'project';
      projectId: string;
    }
  | {
      kind: 'chat';
      projectId: string;
      chatId: string;
    }
  | null;

export type ProjectTreeMenuState =
  | {
      kind: 'project';
      projectId: string;
    }
  | {
      kind: 'chat';
      projectId: string;
      chatId: string;
    };

export type ProjectTreeViewModel = {
  temporaryProject: ProjectTreeProjectRecord | null;
  persistentProjects: readonly ProjectTreeProjectRecord[];
  selectedSidebarItem: ProjectTreeSelection;
  expandedProjectIds: ReadonlySet<string>;
  activeTreeMenuKey: string;
};

export type ProjectTreeRenderHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  formatTreeTimestamp: (value: string | null | undefined) => string;
  renderChevronIcon: () => string;
  renderProjectIcon: () => string;
  renderChatIcon: () => string;
  renderTreeRowActions: (
    menuState: ProjectTreeMenuState,
    project: any,
    browserAction: 'open-chat' | 'open-project',
    browserTitle: string,
    chat?: any,
  ) => string;
};

function getTreeMenuKey(state: ProjectTreeMenuState): string {
  return state.kind === 'project' ? `project::${state.projectId}` : `chat::${state.projectId}::${state.chatId}`;
}

function renderChatNode(
  chat: ProjectTreeChatRecord,
  project: ProjectTreeProjectRecord,
  viewModel: ProjectTreeViewModel,
  helpers: ProjectTreeRenderHelpers,
): string {
  const menuState: ProjectTreeMenuState = {
    kind: 'chat',
    projectId: chat.projectId,
    chatId: chat.chatId,
  };
  const isMenuOpen = viewModel.activeTreeMenuKey === getTreeMenuKey(menuState);
  const isActiveChat = viewModel.selectedSidebarItem?.kind === 'chat'
    && viewModel.selectedSidebarItem.projectId === chat.projectId
    && viewModel.selectedSidebarItem.chatId === chat.chatId;

  return `
    <div
      class="tree-row tree-row--chat ${isMenuOpen ? 'tree-row--menu-open' : ''} ${isActiveChat ? 'tree-row--active-chat' : ''}"
      data-action="select-chat"
      data-project-id="${helpers.escapeHtml(chat.projectId)}"
      data-chat-id="${helpers.escapeHtml(chat.chatId)}"
    >
      <span class="tree-row__indent"></span>
      <span class="tree-row__icon tree-row__icon--chat">${helpers.renderChatIcon()}</span>
      <span class="tree-row__content">
        <span class="tree-row__title">${helpers.escapeHtml(chat.chatName)}</span>
        <span class="tree-row__subtitle">${helpers.escapeHtml(helpers.formatTreeTimestamp(chat.updatedAt))}</span>
      </span>
      ${helpers.renderTreeRowActions(menuState, project, 'open-chat', 'Open chat in browser', chat)}
    </div>
  `;
}

function renderProjectNode(
  project: ProjectTreeProjectRecord,
  viewModel: ProjectTreeViewModel,
  helpers: ProjectTreeRenderHelpers,
): string {
  const isExpanded = viewModel.expandedProjectIds.has(project.projectId);
  const isActiveProject = viewModel.selectedSidebarItem?.projectId === project.projectId;
  const chatsMarkup = project.chats.length
    ? project.chats.map((chat) => renderChatNode(chat, project, viewModel, helpers)).join('')
    : `<div class="tree-empty">No chats captured yet.</div>`;

  const connectMarkup = project.status === 'temporary'
    ? `
        <div class="tree-project__actions">
          <button class="primary-button primary-button--compact" data-action="connect-project" data-project-id="${helpers.escapeHtml(project.projectId)}" type="button">
            Connect Project
          </button>
        </div>
      `
    : '';

  return `
    <section class="tree-project tree-project--${helpers.escapeHtml(project.status)} ${isExpanded ? 'tree-project--expanded' : ''} ${isActiveProject ? 'tree-project--active' : ''}">
      <div
        class="tree-row tree-row--project ${isActiveProject ? 'tree-row--active-project' : ''}"
        data-action="select-project"
        data-project-id="${helpers.escapeHtml(project.projectId)}"
      >
        <button
          class="tree-row__toggle-button"
          data-action="select-project"
          data-project-id="${helpers.escapeHtml(project.projectId)}"
          title="${isExpanded ? 'Collapse project' : 'Expand project'}"
          aria-label="${isExpanded ? 'Collapse project' : 'Expand project'}"
          type="button"
        >
          <span class="tree-row__toggle ${isExpanded ? 'tree-row__toggle--expanded' : ''}">${helpers.renderChevronIcon()}</span>
        </button>
        <span class="tree-row__icon tree-row__icon--project">${helpers.renderProjectIcon()}</span>
        <span class="tree-row__content">
          <span class="tree-row__title">${helpers.escapeHtml(project.projectName)}</span>
          <span class="tree-row__subtitle">${helpers.escapeHtml(helpers.formatTreeTimestamp(project.lastSeenAt))}</span>
        </span>
        ${helpers.renderTreeRowActions({ kind: 'project', projectId: project.projectId }, project, 'open-project', 'Open project in browser')}
      </div>
      <div class="tree-project__children ${isExpanded ? 'tree-project__children--expanded' : ''}">
        ${connectMarkup}
        ${chatsMarkup}
      </div>
    </section>
  `;
}

export function renderProjectTreeMarkup(
  viewModel: ProjectTreeViewModel,
  helpers: ProjectTreeRenderHelpers,
): string {
  if (!viewModel.temporaryProject && !viewModel.persistentProjects.length) {
    return `
      <div class="empty-state">
        Open a ChatGPT project on the right and the sidebar tree will appear here.
      </div>
    `;
  }

  const sections: string[] = [];
  if (viewModel.temporaryProject) {
    sections.push(renderProjectNode(viewModel.temporaryProject, viewModel, helpers));
  }
  if (viewModel.temporaryProject && viewModel.persistentProjects.length) {
    sections.push('<div class="tree-separator"></div>');
  }
  sections.push(...viewModel.persistentProjects.map((project) => renderProjectNode(project, viewModel, helpers)));
  return sections.join('');
}
