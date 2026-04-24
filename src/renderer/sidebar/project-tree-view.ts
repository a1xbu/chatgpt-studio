import type { AppStateSnapshot, ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import { renderProjectTreeMarkup } from './project-tree';
import { renderTreeRowActions as renderTreeRowActionsImpl } from './tree-menu';
import type { SidebarSelection, TreeMenuState } from './types';

export type RenderProjectTreeOptions = {
  state: AppStateSnapshot;
  selectedSidebarItem: SidebarSelection | null;
  expandedProjectIds: ReadonlySet<string>;
  activeTreeMenu: TreeMenuState | null;
  ensureExpandedProjects: (state: AppStateSnapshot) => void;
  getTreeMenuKey: (state: TreeMenuState | null) => string;
  escapeHtml: (value: string | null | undefined) => string;
  formatTreeTimestamp: (value: string | null | undefined) => string;
  renderChevronIcon: () => string;
  renderProjectIcon: () => string;
  renderChatIcon: () => string;
  renderMoreActionsIcon: () => string;
  renderOpenInBrowserIcon: () => string;
};

function renderTreeRowActions(options: {
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
  return renderTreeRowActionsImpl({
    item: options.item,
    project: options.project,
    openAction: options.openAction,
    openTitle: options.openTitle,
    chat: options.chat ?? null,
    activeTreeMenu: options.activeTreeMenu,
    escapeHtml: options.escapeHtml,
    renderMoreActionsIcon: options.renderMoreActionsIcon,
    renderOpenInBrowserIcon: options.renderOpenInBrowserIcon,
  });
}

export function renderProjectTree(options: RenderProjectTreeOptions): string {
  options.ensureExpandedProjects(options.state);

  return renderProjectTreeMarkup(
    {
      temporaryProject: options.state.temporaryProjects[0] ?? null,
      persistentProjects: options.state.persistentProjects,
      selectedSidebarItem: options.selectedSidebarItem,
      expandedProjectIds: options.expandedProjectIds,
      activeTreeMenuKey: options.getTreeMenuKey(options.activeTreeMenu),
    },
    {
      escapeHtml: options.escapeHtml,
      formatTreeTimestamp: options.formatTreeTimestamp,
      renderChevronIcon: options.renderChevronIcon,
      renderProjectIcon: options.renderProjectIcon,
      renderChatIcon: options.renderChatIcon,
      renderTreeRowActions: (item, project, openAction, openTitle, chat) => renderTreeRowActions({
        item,
        project,
        openAction,
        openTitle,
        chat,
        activeTreeMenu: options.activeTreeMenu,
        escapeHtml: options.escapeHtml,
        renderMoreActionsIcon: options.renderMoreActionsIcon,
        renderOpenInBrowserIcon: options.renderOpenInBrowserIcon,
      }),
    },
  );
}
