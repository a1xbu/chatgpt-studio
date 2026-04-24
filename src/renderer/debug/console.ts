export type DebugLogEntry = {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details: string | null;
  source: 'injected-script' | 'guest-preload' | 'webview';
  timestamp: string;
};

export type DebugConsoleViewModel = {
  visibleLogs: readonly DebugLogEntry[];
  debugFilterText: string;
  debugRetentionLimit: number;
};

export type DebugConsoleHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
};

export function renderDebugConsoleMarkup(
  viewModel: DebugConsoleViewModel,
  helpers: DebugConsoleHelpers,
): string {
  if (!viewModel.visibleLogs.length) {
    return `
      <div class="empty-state">
        ${
          viewModel.debugFilterText.trim()
            ? `No log entries match "${helpers.escapeHtml(viewModel.debugFilterText)}" within the last ${helpers.escapeHtml(String(viewModel.debugRetentionLimit))} records.`
            : `Waiting for debug output from the injected script. On page open it will log project name, chat name, ids, and url here.`
        }
      </div>
    `;
  }

  return viewModel.visibleLogs
    .map(
      (entry) => `
        <article class="debug-entry debug-entry--${helpers.escapeHtml(entry.level)}">
          <div class="debug-entry__meta">
            <span>${helpers.escapeHtml(helpers.formatTimestamp(entry.timestamp))}</span>
            <span class="debug-entry__source">${helpers.escapeHtml(entry.source)}</span>
            <span>${helpers.escapeHtml(entry.level.toUpperCase())}</span>
          </div>
          <div class="debug-entry__message">${helpers.escapeHtml(entry.message)}</div>
          ${entry.details ? `<div class="debug-entry__details">${helpers.escapeHtml(entry.details)}</div>` : ''}
        </article>
      `,
    )
    .join('');
}
