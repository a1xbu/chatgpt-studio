import type { ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import type { TreeMenuState } from './types';

export function getTreeMenuKey(state: TreeMenuState | null): string {
  if (!state) {
    return '';
  }

  return state.kind === 'project' ? `project::${state.projectId}` : `chat::${state.projectId}::${state.chatId}`;
}

export function renderSidebarDetailsHeader(options: {
  isSidebarDetailsCollapsed: boolean;
  renderChevronIcon: () => string;
}): string {
  return `
    <button
      class="sidebar-details__header sidebar-details__header--button"
      data-action="toggle-sidebar-details"
      type="button"
      aria-expanded="${String(!options.isSidebarDetailsCollapsed)}"
      title="${options.isSidebarDetailsCollapsed ? 'Expand project details' : 'Collapse project details'}"
    >
      <span>Project details</span>
      <span class="sidebar-details__toggle-icon ${!options.isSidebarDetailsCollapsed ? 'sidebar-details__toggle-icon--expanded' : ''}">${options.renderChevronIcon()}</span>
    </button>
  `;
}

export function renderTreeItemMenu(options: {
  item: TreeMenuState;
  project: SidebarProject;
  chat?: ProjectChatRecord | null;
  escapeHtml: (value: string | null | undefined) => string;
}): string {
  const chat = options.chat ?? null;
  const folderPath = options.project.folderPath ?? '';
  const removeLabel = options.item.kind === 'project' ? 'Remove Project' : 'Remove Chat';
  const removeAction = options.item.kind === 'project' ? 'remove-project' : 'remove-chat';
  const propertiesAction = options.item.kind === 'project' ? 'show-project-properties' : 'show-chat-properties';
  const chatAttributes = options.item.kind === 'chat' && chat ? ` data-chat-id="${options.escapeHtml(chat.chatId)}"` : '';
  const folderActionMarkup = folderPath
    ? `<button class="tree-row__menu-item" data-action="open-project-folder" data-project-id="${options.escapeHtml(options.project.projectId)}" data-folder-path="${options.escapeHtml(folderPath)}"${chatAttributes} type="button">Open project folder</button>`
    : '<button class="tree-row__menu-item tree-row__menu-item--disabled" type="button" disabled>Open project folder</button>';

  return `
    <div class="tree-row__menu" role="menu">
      ${folderActionMarkup}
      <button class="tree-row__menu-item" data-action="${removeAction}" data-project-id="${options.escapeHtml(options.project.projectId)}"${chatAttributes} type="button">${removeLabel}</button>
      <button class="tree-row__menu-item" data-action="${propertiesAction}" data-project-id="${options.escapeHtml(options.project.projectId)}"${chatAttributes} type="button">Properties</button>
    </div>
  `;
}

export function renderTreeRowActions(options: {
  item: TreeMenuState;
  project: SidebarProject;
  openAction: 'open-project' | 'open-chat';
  openTitle: string;
  chat?: ProjectChatRecord | null;
  activeTreeMenu: TreeMenuState | null;
  escapeHtml: (value: string | null | undefined) => string;
  renderMoreActionsIcon: () => string;
  renderOpenInBrowserIcon: () => string;
}): string {
  const chat = options.chat ?? null;
  const chatAttributes = options.item.kind === 'chat' && chat ? ` data-chat-id="${options.escapeHtml(chat.chatId)}"` : '';
  const isMenuOpen = getTreeMenuKey(options.activeTreeMenu) === getTreeMenuKey(options.item);

  return `
    <span class="tree-row__actions">
      <button
        class="tree-row__hover-action"
        data-action="toggle-tree-menu"
        data-project-id="${options.escapeHtml(options.project.projectId)}"${chatAttributes}
        title="More actions"
        aria-label="More actions"
        aria-expanded="${String(isMenuOpen)}"
        type="button"
      >
        ${options.renderMoreActionsIcon()}
      </button>
      <button
        class="tree-row__hover-action"
        data-action="${options.openAction}"
        data-project-id="${options.escapeHtml(options.project.projectId)}"${chatAttributes}
        title="${options.escapeHtml(options.openTitle)}"
        aria-label="${options.escapeHtml(options.openTitle)}"
        type="button"
      >
        ${options.renderOpenInBrowserIcon()}
      </button>
      ${isMenuOpen ? renderTreeItemMenu({ item: options.item, project: options.project, chat, escapeHtml: options.escapeHtml }) : ''}
    </span>
  `;
}
