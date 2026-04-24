import type { AppStateSnapshot, ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import type { SidebarSelection } from './types';
import { renderSidebarDetailsMarkup } from './details';

export type SidebarDetailsRenderOptions = {
  state: AppStateSnapshot;
  sidebarDetailsElement: HTMLElement | null;
  selectedSidebarItem: SidebarSelection | null;
  syncSidebarSelection: (state: AppStateSnapshot) => void;
  renderSidebarDetailsHeader: () => string;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  findKnownProjectUrl: (project: SidebarProject) => string | null;
  normalizeStoredUrl: (value: string | null | undefined) => string | null;
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
};

export function renderSidebarDetails(options: SidebarDetailsRenderOptions): void {
  if (!options.sidebarDetailsElement) {
    return;
  }

  const headerMarkup = options.renderSidebarDetailsHeader();
  options.syncSidebarSelection(options.state);
  if (!options.selectedSidebarItem) {
    options.sidebarDetailsElement.innerHTML = renderSidebarDetailsMarkup(
      {
        kind: 'empty',
        headerMarkup,
      },
      { escapeHtml: options.escapeHtml, formatTimestamp: options.formatTimestamp },
    );
    return;
  }

  if (options.selectedSidebarItem.kind === 'project') {
    const project = options.findSidebarProject(options.state, options.selectedSidebarItem.projectId);
    options.sidebarDetailsElement.innerHTML = renderSidebarDetailsMarkup(
      project
        ? {
            kind: 'project',
            headerMarkup,
            project,
            projectUrl: options.findKnownProjectUrl(project),
          }
        : {
            kind: 'missing-project',
            headerMarkup,
          },
      { escapeHtml: options.escapeHtml, formatTimestamp: options.formatTimestamp },
    );
    return;
  }

  const project = options.findSidebarProject(options.state, options.selectedSidebarItem.projectId);
  const chat = project ? options.findSidebarChat(options.state, options.selectedSidebarItem.projectId, options.selectedSidebarItem.chatId) : null;
  options.sidebarDetailsElement.innerHTML = renderSidebarDetailsMarkup(
    project && chat
      ? {
          kind: 'chat',
          headerMarkup,
          project,
          projectUrl: options.findKnownProjectUrl(project),
          chat,
          chatUrl: options.normalizeStoredUrl(chat.chatUrl),
          chatFiles: project.files.filter((file) => file.chatId === chat.chatId),
        }
      : {
          kind: 'missing-chat',
          headerMarkup,
        },
    { escapeHtml: options.escapeHtml, formatTimestamp: options.formatTimestamp },
  );
}
