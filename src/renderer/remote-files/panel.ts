import type { ArchiveEntryComparisonStatus, ChatFileArchiveEntryRecord, ChatFileRecord } from '../../shared/contracts';

export type RemoteFilesArchiveEntryRecord = ChatFileArchiveEntryRecord;

export type RemoteFilesChatFileRecord = ChatFileRecord;

export type RemoteFilesProjectRecord = {
  folderPath: string | null;
};

export type RemoteFilesPanelEntry = {
  project: RemoteFilesProjectRecord;
  file: RemoteFilesChatFileRecord;
};

export type RemoteFilesNotice = {
  message: string;
  tone: 'info' | 'success' | 'error';
};

export type RemoteFilesDownloadRuntimeState = {
  status?: string | null;
  message?: string | null;
  downloadPath?: string | null;
} | null;

export type RemoteFilesPanelViewModel = {
  entries: RemoteFilesPanelEntry[];
  isCollapsed: boolean;
  downloadAutomatically: boolean;
  notice: RemoteFilesNotice | null;
};

export type RemoteFilesPanelHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  renderApplyIcon: () => string;
  renderArchiveIcon: () => string;
  renderGitBranchIcon: () => string;
  renderBusyIcon: () => string;
  renderCheckIcon: () => string;
  renderChevronIcon: () => string;
  renderDownloadArrowIcon: () => string;
  renderFileTreeFileIcon: () => string;
  renderFolderTreeIcon: (isOpen?: boolean) => string;
  getChatFileKey: (file: Pick<RemoteFilesChatFileRecord, 'chatId' | 'messageId' | 'sandboxPath'>) => string;
  getSandboxFileBaseName: (file: Pick<RemoteFilesChatFileRecord, 'sandboxPath' | 'fileName'>) => string;
  getEffectiveDownloadPath: (file: RemoteFilesChatFileRecord) => string | null;
  getDownloadRuntimeStatus: (file: RemoteFilesChatFileRecord) => RemoteFilesDownloadRuntimeState;
  getArchiveEntriesForFile: (file: RemoteFilesChatFileRecord) => RemoteFilesArchiveEntryRecord[];
  isRootExpanded: (file: RemoteFilesChatFileRecord) => boolean;
  isArchiveDirectoryExpanded: (file: RemoteFilesChatFileRecord, relativePath: string) => boolean;
};

export function isZipLikeRemoteFile(file: Pick<RemoteFilesChatFileRecord, 'sandboxPath' | 'fileName' | 'downloadPath'>): boolean {
  const candidate = (file.downloadPath ?? file.fileName ?? file.sandboxPath ?? '').trim().toLowerCase();
  return candidate.endsWith('.zip');
}

export function isGitBundleRemoteFile(file: Pick<RemoteFilesChatFileRecord, 'sandboxPath' | 'fileName' | 'downloadPath' | 'gitBundle'>): boolean {
  const candidate = (file.downloadPath ?? file.fileName ?? file.sandboxPath ?? '').trim().toLowerCase();
  return Boolean(file.gitBundle) || candidate.endsWith('.bundle') || candidate.endsWith('.gitbundle');
}

export function canApplyRemoteFile(file: RemoteFilesChatFileRecord, effectiveDownloadPath: string | null): boolean {
  if (!effectiveDownloadPath) {
    return false;
  }
  if (isGitBundleRemoteFile(file)) {
    return !file.gitBundle || file.gitBundle.status === 'ready' || file.gitBundle.status === 'unknown' || file.gitBundle.status === 'error';
  }
  return true;
}

export function getRemoteFileRootKey(file: Pick<RemoteFilesChatFileRecord, 'chatId' | 'messageId' | 'sandboxPath'>, getChatFileKey: RemoteFilesPanelHelpers['getChatFileKey']): string {
  return `root::${getChatFileKey(file)}`;
}

export function getRemoteFileArchiveBranchKey(
  file: Pick<RemoteFilesChatFileRecord, 'chatId' | 'messageId' | 'sandboxPath'>,
  getChatFileKey: RemoteFilesPanelHelpers['getChatFileKey'],
  relativePath = '',
): string {
  return `archive::${getChatFileKey(file)}::${relativePath}`;
}

export function formatUpdatedFilesMessage(updatedFileCount: number, message?: string | null): string {
  return message ?? `Updated ${updatedFileCount} file${updatedFileCount === 1 ? '' : 's'}.`;
}

function getArchiveEntryBaseName(relativePath: string): string {
  const segments = relativePath.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? relativePath;
}

function getArchiveEntryChildren(
  file: RemoteFilesChatFileRecord,
  getArchiveEntriesForFile: RemoteFilesPanelHelpers['getArchiveEntriesForFile'],
  parentRelativePath = '',
): RemoteFilesArchiveEntryRecord[] {
  const entries = getArchiveEntriesForFile(file);
  return entries.filter((entry) => {
    const parentPath = parentRelativePath.trim();
    const entryParent = entry.relativePath.includes('/') ? entry.relativePath.slice(0, entry.relativePath.lastIndexOf('/')) : '';
    return entryParent === parentPath;
  });
}

function getArchiveEntryComparisonStatus(entry: RemoteFilesArchiveEntryRecord): ArchiveEntryComparisonStatus {
  return entry.comparisonStatus === 'new' || entry.comparisonStatus === 'modified' ? entry.comparisonStatus : 'unchanged';
}

function getArchiveEntryRowClass(entry: RemoteFilesArchiveEntryRecord): string {
  const status = getArchiveEntryComparisonStatus(entry);
  if (status === 'new') {
    return 'new-files-tree__row--new';
  }
  if (status === 'modified') {
    return 'new-files-tree__row--modified';
  }
  return '';
}

function archiveHasContentChanges(
  file: RemoteFilesChatFileRecord,
  getArchiveEntriesForFile: RemoteFilesPanelHelpers['getArchiveEntriesForFile'],
): boolean {
  return getArchiveEntriesForFile(file).some((entry) => entry.kind === 'file' && getArchiveEntryComparisonStatus(entry) !== 'unchanged');
}

function renderGitBundleDetails(file: RemoteFilesChatFileRecord, helpers: RemoteFilesPanelHelpers): string {
  if (!isGitBundleRemoteFile(file)) {
    return '';
  }

  const bundle = file.gitBundle ?? null;
  const status = bundle?.status ?? 'unknown';
  const latest = bundle?.latestBranch ?? null;
  const statusLabel = status === 'ready'
    ? 'ready'
    : status === 'applied'
      ? 'applied'
      : status === 'unrelated'
        ? 'unrelated'
        : status === 'invalid'
          ? 'invalid'
          : status === 'error'
            ? 'error'
            : 'unknown';
  const branchMarkup = latest
    ? `
      <div class="new-files-tree__git-line"><span>Branch</span><strong>${helpers.escapeHtml(latest.branchName)}</strong></div>
      <div class="new-files-tree__git-line"><span>Commit</span><strong>${helpers.escapeHtml(latest.shortHash)}</strong><em>${helpers.escapeHtml(latest.subject || 'No commit subject')}</em></div>
      <div class="new-files-tree__git-line"><span>Date</span><strong>${helpers.escapeHtml(helpers.formatTimestamp(latest.committedAt))}</strong></div>
      <div class="new-files-tree__git-line"><span>Relation</span><strong>${helpers.escapeHtml(latest.relation)}</strong></div>
    `
    : '<div class="new-files-tree__git-line new-files-tree__git-line--empty">Git bundle branch information is unavailable.</div>';
  const messageMarkup = bundle?.message || file.applyError
    ? `<div class="new-files-tree__git-message">${helpers.escapeHtml(bundle?.message ?? file.applyError ?? '')}</div>`
    : '';

  return `
    <div class="new-files-tree__git-details new-files-tree__git-details--${helpers.escapeHtml(statusLabel)}">
      <div class="new-files-tree__git-status">${helpers.escapeHtml(statusLabel)}</div>
      ${branchMarkup}
      ${messageMarkup}
    </div>
  `;
}

function renderRemoteFilesStatusAction(
  project: RemoteFilesProjectRecord,
  file: RemoteFilesChatFileRecord,
  helpers: RemoteFilesPanelHelpers,
): string {
  const fileKey = helpers.getChatFileKey(file);
  const runtime = helpers.getDownloadRuntimeStatus(file);
  const effectiveDownloadPath = helpers.getEffectiveDownloadPath(file);

  if (!project.folderPath) {
    return `<button class="new-files-tree__status-button" type="button" disabled title="Connect project first" aria-label="Connect project first">${helpers.renderDownloadArrowIcon()}</button>`;
  }

  if (effectiveDownloadPath) {
    const label = file.appliedAt ? `Downloaded. Applied ${helpers.formatTimestamp(file.appliedAt)}` : 'Downloaded';
    return `<button class="new-files-tree__status-button new-files-tree__status-button--downloaded" type="button" disabled title="${helpers.escapeHtml(label)}" aria-label="${helpers.escapeHtml(label)}">${helpers.renderCheckIcon()}</button>`;
  }

  if (runtime?.status === 'waiting' || runtime?.status === 'resolving' || runtime?.status === 'downloading' || runtime?.status === 'saving') {
    const label = runtime.message ?? 'Downloading';
    return `<button class="new-files-tree__status-button new-files-tree__status-button--busy" type="button" disabled title="${helpers.escapeHtml(label)}" aria-label="${helpers.escapeHtml(label)}">${helpers.renderBusyIcon()}</button>`;
  }

  const title = runtime?.status === 'error'
    ? runtime.message ? `Retry download: ${runtime.message}` : 'Retry download'
    : 'Download';
  return `<button class="new-files-tree__status-button new-files-tree__status-button--download" data-action="download-new-file" data-file-key="${helpers.escapeHtml(fileKey)}" type="button" title="${helpers.escapeHtml(title)}" aria-label="${helpers.escapeHtml(title)}">${helpers.renderDownloadArrowIcon()}</button>`;
}

function renderRemoteFileApplyButton(
  file: RemoteFilesChatFileRecord,
  helpers: RemoteFilesPanelHelpers,
  relativePath: string | null,
  includeForDirectories = false,
): string {
  const effectiveDownloadPath = helpers.getEffectiveDownloadPath(file);
  if (!canApplyRemoteFile(file, effectiveDownloadPath)) {
    return '';
  }

  if (relativePath && !includeForDirectories) {
    return `<button class="new-files-tree__hover-action" data-action="apply-new-file-entry" data-file-key="${helpers.escapeHtml(helpers.getChatFileKey(file))}" data-relative-path="${helpers.escapeHtml(relativePath)}" type="button" title="Apply" aria-label="Apply">${helpers.renderApplyIcon()}</button>`;
  }

  if (relativePath && includeForDirectories) {
    return `<button class="new-files-tree__hover-action" data-action="apply-new-file-entry" data-file-key="${helpers.escapeHtml(helpers.getChatFileKey(file))}" data-relative-path="${helpers.escapeHtml(relativePath)}" type="button" title="Apply" aria-label="Apply">${helpers.renderApplyIcon()}</button>`;
  }

  return `<button class="new-files-tree__hover-action" data-action="apply-new-file" data-file-key="${helpers.escapeHtml(helpers.getChatFileKey(file))}" type="button" title="Apply" aria-label="Apply">${helpers.renderApplyIcon()}</button>`;
}

function renderRemoteFilesArchiveRows(
  file: RemoteFilesChatFileRecord,
  parentRelativePath: string,
  depth: number,
  helpers: RemoteFilesPanelHelpers,
): string {
  const children = getArchiveEntryChildren(file, helpers.getArchiveEntriesForFile, parentRelativePath)
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
      }
      return left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base', numeric: true });
    });

  return children.map((entry) => {
    const isDirectory = entry.kind === 'directory';
    const hasChildren = isDirectory && getArchiveEntryChildren(file, helpers.getArchiveEntriesForFile, entry.relativePath).length > 0;
    const isExpanded = isDirectory && helpers.isArchiveDirectoryExpanded(file, entry.relativePath);
    const rowDiffClass = getArchiveEntryRowClass(entry);
    const iconMarkup = isDirectory ? helpers.renderFolderTreeIcon(isExpanded) : helpers.renderFileTreeFileIcon();
    const toggleMarkup = hasChildren
      ? `<button class="new-files-tree__toggle-button" data-action="toggle-new-file-archive-directory" data-file-key="${helpers.escapeHtml(helpers.getChatFileKey(file))}" data-relative-path="${helpers.escapeHtml(entry.relativePath)}" type="button" aria-label="${isExpanded ? 'Collapse' : 'Expand'}"><span class="new-files-tree__toggle ${isExpanded ? 'new-files-tree__toggle--expanded' : ''}">${helpers.renderChevronIcon()}</span></button>`
      : '<span class="new-files-tree__toggle new-files-tree__toggle--placeholder"></span>';
    const actionsMarkup = isDirectory
      ? ''
      : `<span class="new-files-tree__actions">${renderRemoteFileApplyButton(file, helpers, entry.relativePath)}</span>`;

    return `
      <div class="new-files-tree__item">
        <div class="new-files-tree__row ${isDirectory ? 'new-files-tree__row--directory' : 'new-files-tree__row--file'} ${rowDiffClass}" style="--new-files-depth:${depth};" title="${helpers.escapeHtml(entry.relativePath)}">
          ${toggleMarkup}
          <span class="new-files-tree__icon">${iconMarkup}</span>
          <span class="new-files-tree__label">${helpers.escapeHtml(getArchiveEntryBaseName(entry.relativePath))}</span>
          ${actionsMarkup}
        </div>
        ${isExpanded ? `<div class="new-files-tree__children">${renderRemoteFilesArchiveRows(file, entry.relativePath, depth + 1, helpers)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderRemoteFilesRootRows(viewModel: RemoteFilesPanelViewModel, helpers: RemoteFilesPanelHelpers): string {
  return viewModel.entries.map(({ project, file }) => {
    const fileKey = helpers.getChatFileKey(file);
    const isArchive = isZipLikeRemoteFile(file);
    const isGitBundle = isGitBundleRemoteFile(file);
    const fileName = helpers.getSandboxFileBaseName(file);
    const archiveChildren = isArchive ? helpers.getArchiveEntriesForFile(file) : [];
    const hasChildren = isArchive && archiveChildren.length > 0;
    const rootExpanded = hasChildren && helpers.isRootExpanded(file);
    const archiveDiffClass = isArchive && archiveHasContentChanges(file, helpers.getArchiveEntriesForFile) ? 'new-files-tree__row--modified' : '';
    const toggleMarkup = hasChildren
      ? `<button class="new-files-tree__toggle-button" data-action="toggle-new-file-root" data-file-key="${helpers.escapeHtml(fileKey)}" type="button" aria-label="${rootExpanded ? 'Collapse' : 'Expand'}"><span class="new-files-tree__toggle ${rootExpanded ? 'new-files-tree__toggle--expanded' : ''}">${helpers.renderChevronIcon()}</span></button>`
      : '<span class="new-files-tree__toggle new-files-tree__toggle--placeholder"></span>';
    const iconMarkup = isGitBundle ? helpers.renderGitBranchIcon() : isArchive ? helpers.renderArchiveIcon() : helpers.renderFileTreeFileIcon();
    const tooltipParts = [file.sandboxPath];
    if (file.projectSummary) {
      tooltipParts.push(file.projectSummary);
    }
    if (file.applyError) {
      tooltipParts.push(`Apply error: ${file.applyError}`);
    }
    const effectiveDownloadPath = helpers.getEffectiveDownloadPath(file);
    const statusActionMarkup = renderRemoteFilesStatusAction(project, file, helpers);
    const applyActionMarkup = canApplyRemoteFile(file, effectiveDownloadPath)
      ? renderRemoteFileApplyButton(file, helpers, null, isArchive)
      : '';
    const gitBundleDetailsMarkup = renderGitBundleDetails(file, helpers);

    return `
      <div class="new-files-tree__item">
        <div class="new-files-tree__row ${isGitBundle ? 'new-files-tree__row--git-bundle' : isArchive ? 'new-files-tree__row--archive' : 'new-files-tree__row--file'} ${archiveDiffClass}" style="--new-files-depth:0;" title="${helpers.escapeHtml(tooltipParts.join('\n'))}">
          ${toggleMarkup}
          <span class="new-files-tree__icon">${iconMarkup}</span>
          <span class="new-files-tree__label">${helpers.escapeHtml(fileName)}</span>
          <span class="new-files-tree__actions">
            ${applyActionMarkup}
            ${statusActionMarkup}
          </span>
        </div>
        ${gitBundleDetailsMarkup}
        ${rootExpanded ? `<div class="new-files-tree__children">${renderRemoteFilesArchiveRows(file, '', 1, helpers)}</div>` : ''}
      </div>
    `;
  }).join('');
}

export function renderRemoteFilesPanelMarkup(
  viewModel: RemoteFilesPanelViewModel,
  helpers: RemoteFilesPanelHelpers,
): string {
  const downloadedEntries = viewModel.entries.filter(({ file }) => canApplyRemoteFile(file, helpers.getEffectiveDownloadPath(file)) && !isZipLikeRemoteFile(file));
  const rows = renderRemoteFilesRootRows(viewModel, helpers);

  return `
    <div class="new-files-panel__header">
      <div class="new-files-panel__title">Remote files</div>
      <div class="new-files-panel__actions">
        <label class="toggle-switch" title="Download automatically">
          <input id="download-automatically-toggle" type="checkbox" ${viewModel.downloadAutomatically ? 'checked' : ''} />
          <span>Download automatically</span>
        </label>
        <button class="new-files-panel__collapse-button" data-action="toggle-new-files-collapse" type="button" title="${viewModel.isCollapsed ? 'Expand Remote files' : 'Collapse Remote files'}" aria-label="${viewModel.isCollapsed ? 'Expand Remote files' : 'Collapse Remote files'}">
          <span class="new-files-panel__collapse-icon ${!viewModel.isCollapsed ? 'new-files-panel__collapse-icon--expanded' : ''}">${helpers.renderChevronIcon()}</span>
        </button>
      </div>
      ${viewModel.notice ? `<div class="new-files-panel__notice new-files-panel__notice--${viewModel.notice.tone}">${helpers.escapeHtml(viewModel.notice.message)}</div>` : ''}
    </div>
    <div class="new-files-panel__list"><div class="new-files-tree">${rows}</div></div>
    ${!viewModel.isCollapsed ? `<div class="new-files-panel__footer"><button class="new-files-panel__apply-all" data-action="apply-all-new-files" type="button" ${downloadedEntries.length ? '' : 'disabled'}>Apply all</button></div>` : ''}
  `;
}
