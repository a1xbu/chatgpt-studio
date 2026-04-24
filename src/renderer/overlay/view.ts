import type { AppStateSnapshot, ChatFileRecord, ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import { buildArchiveApplyWarningDialogMarkup, buildPromptNameDialogMarkup, buildPropertiesDialogMarkup } from './dialogs';
import type { ArchiveApplyWarningDialogState, PromptNameDialogState, PropertiesDialogState } from '../sidebar/types';

export type OverlayRenderOptions = {
  overlayRootElement: HTMLElement;
  promptNameDialogState: PromptNameDialogState | null;
  archiveApplyWarningDialogState: ArchiveApplyWarningDialogState | null;
  setArchiveApplyWarningDialogState: (state: ArchiveApplyWarningDialogState | null) => void;
  propertiesDialogState: PropertiesDialogState;
  setPropertiesDialogState: (state: PropertiesDialogState) => void;
  currentState: AppStateSnapshot | null;
  findLatestNewFileByKey: (fileKey: string) => { file: ChatFileRecord } | null;
  remoteManifestFile: string;
  getRemoteManifestPrompt: (projectId: string) => string;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  findChatEditorTab: (projectId: string, chatId: string) => { history: { messageCount: number } | null } | null;
  formatTimestamp: (value: string | null | undefined) => string;
  escapeHtml: (value: string | null | undefined) => string;
};

export function renderOverlayDialog(options: OverlayRenderOptions): void {
  if (options.promptNameDialogState) {
    options.overlayRootElement.innerHTML = buildPromptNameDialogMarkup(
      {
        title: options.promptNameDialogState.title,
        confirmLabel: options.promptNameDialogState.confirmLabel,
        value: options.promptNameDialogState.initialValue,
        errorMessage: options.promptNameDialogState.errorMessage,
      },
      { escapeHtml: options.escapeHtml },
    );

    window.requestAnimationFrame(() => {
      const input = options.overlayRootElement.querySelector('[data-role="prompt-name-input"]');
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
    return;
  }

  if (options.archiveApplyWarningDialogState) {
    const target = options.findLatestNewFileByKey(options.archiveApplyWarningDialogState.fileKey);
    if (!target) {
      options.setArchiveApplyWarningDialogState(null);
      options.overlayRootElement.innerHTML = '';
      return;
    }

    const file = target.file;
    options.overlayRootElement.innerHTML = buildArchiveApplyWarningDialogMarkup(
      {
        fileKey: options.archiveApplyWarningDialogState.fileKey,
        fileName: file.fileName ?? file.sandboxPath,
        projectId: file.projectId,
        manifestFile: options.remoteManifestFile,
        promptText: options.getRemoteManifestPrompt(file.projectId),
        remoteManifestProjectId: file.remoteManifestProjectId ?? null,
        manifestStatus: file.remoteManifestStatus ?? (file.hasRemoteManifest ? 'matched' : 'missing'),
        relativePath: options.archiveApplyWarningDialogState.relativePath ?? null,
        isDangerous: (file.remoteManifestStatus ?? (file.hasRemoteManifest ? 'matched' : 'missing')) !== 'matched',
      },
      { escapeHtml: options.escapeHtml },
    );
    return;
  }

  if (!options.currentState || !options.propertiesDialogState) {
    options.overlayRootElement.innerHTML = '';
    return;
  }

  let title = '';
  let bodyMarkup = '';

  if (options.propertiesDialogState.kind === 'project') {
    const project = options.findSidebarProject(options.currentState, options.propertiesDialogState.projectId);
    if (!project) {
      options.setPropertiesDialogState(null);
      options.overlayRootElement.innerHTML = '';
      return;
    }

    title = 'Project properties';
    bodyMarkup = `
      <dl class="properties-dialog__grid">
        <dt>Name</dt><dd>${options.escapeHtml(project.projectName)}</dd>
        <dt>ID</dt><dd>${options.escapeHtml(project.projectId)}</dd>
        <dt>Status</dt><dd>${options.escapeHtml(project.status)}</dd>
        <dt>Folder</dt><dd>${options.escapeHtml(project.folderPath ?? '—')}</dd>
        <dt>URL</dt><dd>${options.escapeHtml(project.projectUrl ?? '—')}</dd>
        <dt>Chats</dt><dd>${String(project.chats.length)}</dd>
        <dt>Files</dt><dd>${String(project.files.length)}</dd>
        <dt>Last seen</dt><dd>${options.escapeHtml(options.formatTimestamp(project.lastSeenAt))}</dd>
      </dl>
    `;
  } else {
    const project = options.findSidebarProject(options.currentState, options.propertiesDialogState.projectId);
    const chat = project ? options.findSidebarChat(options.currentState, options.propertiesDialogState.projectId, options.propertiesDialogState.chatId) : null;
    if (!project || !chat) {
      options.setPropertiesDialogState(null);
      options.overlayRootElement.innerHTML = '';
      return;
    }

    const openTab = options.findChatEditorTab(project.projectId, chat.chatId);
    const history = openTab?.history ?? null;
    const fileCount = project.files.filter((file) => file.chatId === chat.chatId).length;

    title = 'Chat properties';
    bodyMarkup = `
      <dl class="properties-dialog__grid">
        <dt>Name</dt><dd>${options.escapeHtml(chat.chatName)}</dd>
        <dt>ID</dt><dd>${options.escapeHtml(chat.chatId)}</dd>
        <dt>Project</dt><dd>${options.escapeHtml(project.projectName)}</dd>
        <dt>Project ID</dt><dd>${options.escapeHtml(project.projectId)}</dd>
        <dt>URL</dt><dd>${options.escapeHtml(chat.chatUrl ?? '—')}</dd>
        <dt>Updated</dt><dd>${options.escapeHtml(options.formatTimestamp(chat.updatedAt))}</dd>
        <dt>Messages</dt><dd>${history ? String(history.messageCount) : '—'}</dd>
        <dt>Files</dt><dd>${String(fileCount)}</dd>
      </dl>
    `;
  }

  options.overlayRootElement.innerHTML = buildPropertiesDialogMarkup(
    {
      title,
      bodyMarkup,
    },
    { escapeHtml: options.escapeHtml },
  );
}
