export type PromptNameDialogViewModel = {
  title: string;
  confirmLabel: string;
  value: string;
  errorMessage: string | null;
};

export type ArchiveApplyWarningViewModel = {
  fileKey: string;
  fileName: string;
  projectId: string;
  manifestFile: string;
  promptText: string;
  remoteManifestProjectId: string | null;
  manifestStatus: 'missing' | 'matched' | 'mismatched' | 'invalid' | null;
  relativePath: string | null;
  hasProjectIdMismatch: boolean;
};

export type PropertiesDialogViewModel = {
  title: string;
  bodyMarkup: string;
};

export type OverlayDialogHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
};

export function buildPromptNameDialogMarkup(
  viewModel: PromptNameDialogViewModel,
  helpers: OverlayDialogHelpers,
): string {
  const errorMarkup = viewModel.errorMessage
    ? `<div class="prompt-name-dialog__error">${helpers.escapeHtml(viewModel.errorMessage)}</div>`
    : '';

  return `
    <div class="modal-backdrop">
      <div class="properties-dialog prompt-name-dialog" role="dialog" aria-modal="true" aria-label="${helpers.escapeHtml(viewModel.title)}">
        <div class="properties-dialog__header">
          <h2 class="properties-dialog__title">${helpers.escapeHtml(viewModel.title)}</h2>
        </div>
        <div class="properties-dialog__body">
          <div class="prompt-name-dialog__field">
            <label class="prompt-name-dialog__label" for="prompt-name-input">File name</label>
            <input id="prompt-name-input" class="prompt-name-dialog__input" data-role="prompt-name-input" type="text" value="${helpers.escapeHtml(viewModel.value)}" placeholder="Prompt name.md" autofocus />
            <div class="prompt-name-dialog__hint">The <code>.md</code> extension will be added automatically if omitted.</div>
            ${errorMarkup}
          </div>
          <div class="properties-dialog__actions">
            <button class="secondary-button secondary-button--small" data-action="cancel-prompt-name-dialog" type="button">Cancel</button>
            <button class="primary-button secondary-button--small" data-action="confirm-prompt-name-dialog" type="button">${helpers.escapeHtml(viewModel.confirmLabel)}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildArchiveApplyWarningDialogMarkup(
  viewModel: ArchiveApplyWarningViewModel,
  helpers: OverlayDialogHelpers,
): string {
  const targetDescription = viewModel.relativePath
    ? `entry <strong>${helpers.escapeHtml(viewModel.relativePath)}</strong> from archive <strong>${helpers.escapeHtml(viewModel.fileName)}</strong>`
    : `archive <strong>${helpers.escapeHtml(viewModel.fileName)}</strong>`;
  const manifestValidationWarning = viewModel.manifestStatus === 'missing'
    ? `
      <div class="properties-dialog__warning-copy">
        The downloaded archive does not contain <code>${helpers.escapeHtml(viewModel.manifestFile)}</code>, so project_id cannot be validated before overwrite.
      </div>
    `
    : viewModel.manifestStatus === 'invalid'
      ? `
        <div class="properties-dialog__warning-copy">
          The downloaded archive contains an invalid <code>${helpers.escapeHtml(viewModel.manifestFile)}</code>, so project_id cannot be validated before overwrite.
        </div>
      `
      : '';
  const mismatchWarning = viewModel.hasProjectIdMismatch
    ? `
      <div class="properties-dialog__danger-copy">
        The downloaded bundle declares project_id <code>${helpers.escapeHtml(viewModel.remoteManifestProjectId ?? 'unknown')}</code>, but the current project is <code>${helpers.escapeHtml(viewModel.projectId)}</code>.
        This bundle may belong to another project and is dangerous to apply.
      </div>
    `
    : '';
  const confirmClass = viewModel.hasProjectIdMismatch
    ? 'danger-button secondary-button secondary-button--small'
    : 'primary-button secondary-button--small';
  const confirmLabel = viewModel.hasProjectIdMismatch ? 'Apply anyway' : 'Apply and overwrite';
  const relativePathAttribute = viewModel.relativePath
    ? ` data-relative-path="${helpers.escapeHtml(viewModel.relativePath)}"`
    : '';

  return `
    <div class="modal-backdrop">
      <div class="properties-dialog properties-dialog--warning${viewModel.hasProjectIdMismatch ? ' properties-dialog--danger' : ''}" role="dialog" aria-modal="true" aria-label="Archive apply warning">
        <div class="properties-dialog__header">
          <h2 class="properties-dialog__title">Apply files?</h2>
        </div>
        <div class="properties-dialog__body">
          <div class="properties-dialog__warning-copy">
            Applying ${targetDescription} will overwrite matching files in the current project folder.
          </div>
          ${manifestValidationWarning}
          ${mismatchWarning}
          <div class="properties-dialog__actions">
            <button class="secondary-button secondary-button--small" data-action="cancel-archive-apply-warning" type="button">Cancel</button>
            <button class="${confirmClass}" data-action="confirm-archive-apply-warning" data-file-key="${helpers.escapeHtml(viewModel.fileKey)}"${relativePathAttribute} type="button">${confirmLabel}</button>
          </div>
          <details class="archive-help">
            <summary>How to avoid problems?</summary>
            <div class="archive-help__body">
              <p>Ask ChatGPT to always include <code>${helpers.escapeHtml(viewModel.manifestFile)}</code> in the project ZIP. Then the client can validate <code>project_id</code> before applying the archive.</p>
              <div class="archive-help__prompt">
                <div class="archive-help__prompt-header">
                  <span>Prompt example</span>
                  <button class="secondary-button secondary-button--small" data-action="copy-remote-manifest-prompt" data-project-id="${helpers.escapeHtml(viewModel.projectId)}" type="button">Copy</button>
                </div>
                <pre class="archive-help__prompt-box"><code>${helpers.escapeHtml(viewModel.promptText)}</code></pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  `;
}

export function buildPropertiesDialogMarkup(
  viewModel: PropertiesDialogViewModel,
  helpers: OverlayDialogHelpers,
): string {
  return `
    <div class="modal-backdrop" data-action="close-properties-dialog">
      <div class="properties-dialog" role="dialog" aria-modal="true" aria-label="${helpers.escapeHtml(viewModel.title)}">
        <div class="properties-dialog__header">
          <h2 class="properties-dialog__title">${helpers.escapeHtml(viewModel.title)}</h2>
          <button class="properties-dialog__close" data-action="close-properties-dialog" type="button" aria-label="Close">×</button>
        </div>
        <div class="properties-dialog__body">
          ${viewModel.bodyMarkup}
        </div>
      </div>
    </div>
  `;
}
