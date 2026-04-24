export type SidebarDetailsChatFileRecord = {
  chatId: string;
  messageId: string;
  sandboxPath: string;
  downloadUrl: string | null;
  downloadPath: string | null;
};

export type SidebarDetailsProjectRecord = {
  projectId: string;
  projectName: string;
  folderPath: string | null;
  lastSeenAt: string;
  status: 'temporary' | 'persistent';
  files: SidebarDetailsChatFileRecord[];
};

export type SidebarDetailsChatRecord = {
  chatId: string;
  chatName: string;
  chatUrl: string | null;
  updatedAt: string;
};

export type SidebarDetailsViewModel =
  | {
      kind: 'empty';
      headerMarkup: string;
    }
  | {
      kind: 'missing-project';
      headerMarkup: string;
    }
  | {
      kind: 'missing-chat';
      headerMarkup: string;
    }
  | {
      kind: 'project';
      headerMarkup: string;
      project: SidebarDetailsProjectRecord;
      projectUrl: string | null;
    }
  | {
      kind: 'chat';
      headerMarkup: string;
      project: SidebarDetailsProjectRecord;
      projectUrl: string | null;
      chat: SidebarDetailsChatRecord;
      chatUrl: string | null;
      chatFiles: SidebarDetailsChatFileRecord[];
    };

export type SidebarDetailsHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
};

function renderFilesTable(
  files: readonly SidebarDetailsChatFileRecord[],
  helpers: SidebarDetailsHelpers,
): string {
  if (!files.length) {
    return '<div class="details-empty details-empty--compact">No sandbox files captured yet.</div>';
  }

  const rows = files
    .map((file) => {
      return `
        <tr>
          <td>${helpers.escapeHtml(file.chatId)}</td>
          <td>${helpers.escapeHtml(file.messageId)}</td>
          <td title="${helpers.escapeHtml(file.sandboxPath)}">${helpers.escapeHtml(file.sandboxPath)}</td>
          <td title="${helpers.escapeHtml(file.downloadUrl ?? '')}">${helpers.escapeHtml(file.downloadUrl ?? '—')}</td>
          <td title="${helpers.escapeHtml(file.downloadPath ?? '')}">${helpers.escapeHtml(file.downloadPath ?? '—')}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="details-files">
      <div class="details-files__header">Sandbox files (${String(files.length)})</div>
      <div class="details-files__table-wrap">
        <table class="details-files__table">
          <thead>
            <tr>
              <th>chat_id</th>
              <th>message_id</th>
              <th>sandbox_path</th>
              <th>download_url</th>
              <th>download</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDetailsActions(
  project: SidebarDetailsProjectRecord,
  helpers: SidebarDetailsHelpers,
): string {
  const actions: string[] = [];

  if (project.folderPath) {
    actions.push(`
      <button class="secondary-button secondary-button--small" data-action="open-folder" data-folder-path="${helpers.escapeHtml(project.folderPath)}" type="button">
        Open Folder
      </button>
    `);
  }

  if (project.status === 'persistent') {
    actions.push(`
      <button class="secondary-button secondary-button--small danger-button" data-action="remove-project" data-project-id="${helpers.escapeHtml(project.projectId)}" type="button">
        Remove Project
      </button>
    `);
  }

  if (!actions.length) {
    return '';
  }

  return `
    <div class="details-actions">
      ${actions.join('')}
    </div>
  `;
}

export function renderSidebarDetailsMarkup(
  viewModel: SidebarDetailsViewModel,
  helpers: SidebarDetailsHelpers,
): string {
  if (viewModel.kind === 'empty') {
    return `
      ${viewModel.headerMarkup}
      <div class="sidebar-details__body">
        <div class="details-empty">Select a project or chat to inspect its details.</div>
      </div>
    `;
  }

  if (viewModel.kind === 'missing-project') {
    return `
      ${viewModel.headerMarkup}
      <div class="sidebar-details__body">
        <div class="details-empty">The selected project is no longer available.</div>
      </div>
    `;
  }

  if (viewModel.kind === 'missing-chat') {
    return `
      ${viewModel.headerMarkup}
      <div class="sidebar-details__body">
        <div class="details-empty">The selected chat is no longer available.</div>
      </div>
    `;
  }

  if (viewModel.kind === 'project') {
    const { project, projectUrl } = viewModel;
    return `
      ${viewModel.headerMarkup}
      <div class="sidebar-details__body">
        <h3 class="details-title">${helpers.escapeHtml(project.projectName)}</h3>
        <dl class="details-grid">
          <dt>Project ID</dt>
          <dd>${helpers.escapeHtml(project.projectId)}</dd>
          <dt>Project Name</dt>
          <dd>${helpers.escapeHtml(project.projectName)}</dd>
          <dt>Project URL</dt>
          <dd>${helpers.escapeHtml(projectUrl ?? 'Not captured yet')}</dd>
          <dt>Last Seen</dt>
          <dd>${helpers.escapeHtml(helpers.formatTimestamp(project.lastSeenAt))}</dd>
          <dt>Folder Path</dt>
          <dd>${helpers.escapeHtml(project.folderPath ?? 'Not connected')}</dd>
        </dl>
        ${renderFilesTable(project.files, helpers)}
        ${renderDetailsActions(project, helpers)}
      </div>
    `;
  }

  const { project, projectUrl, chat, chatUrl, chatFiles } = viewModel;
  return `
    ${viewModel.headerMarkup}
    <div class="sidebar-details__body">
      <h3 class="details-title">${helpers.escapeHtml(chat.chatName)}</h3>
      <dl class="details-grid">
        <dt>Chat ID</dt>
        <dd>${helpers.escapeHtml(chat.chatId)}</dd>
        <dt>Chat Name</dt>
        <dd>${helpers.escapeHtml(chat.chatName)}</dd>
        <dt>Chat URL</dt>
        <dd>${helpers.escapeHtml(chatUrl ?? 'Not captured yet')}</dd>
        <dt>Chat Date</dt>
        <dd>${helpers.escapeHtml(helpers.formatTimestamp(chat.updatedAt))}</dd>
        <dt>Project ID</dt>
        <dd>${helpers.escapeHtml(project.projectId)}</dd>
        <dt>Project Name</dt>
        <dd>${helpers.escapeHtml(project.projectName)}</dd>
        <dt>Project URL</dt>
        <dd>${helpers.escapeHtml(projectUrl ?? 'Not captured yet')}</dd>
        <dt>Project Date</dt>
        <dd>${helpers.escapeHtml(helpers.formatTimestamp(project.lastSeenAt))}</dd>
        <dt>Folder Path</dt>
        <dd>${helpers.escapeHtml(project.folderPath ?? 'Not connected')}</dd>
      </dl>
      ${renderFilesTable(chatFiles, helpers)}
      ${renderDetailsActions(project, helpers)}
    </div>
  `;
}
