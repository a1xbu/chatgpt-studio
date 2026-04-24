import type { DebugLogEntry } from '../../shared/contracts';
import { renderDebugConsoleMarkup } from './console';

export type DebugRuntimeState = {
  debugLogs: DebugLogEntry[];
  debugFilterText: string;
  debugRetentionLimit: number;
};

export function getVisibleDebugLogs(state: DebugRuntimeState): DebugLogEntry[] {
  const retainedLogs = state.debugLogs.slice(-state.debugRetentionLimit);
  const normalizedFilter = state.debugFilterText.trim().toLowerCase();
  if (!normalizedFilter) {
    return retainedLogs;
  }

  return retainedLogs.filter((entry) =>
    [entry.timestamp, entry.source, entry.level, entry.message, entry.details ?? '']
      .join('\n')
      .toLowerCase()
      .includes(normalizedFilter),
  );
}

export function formatDebugLogsForClipboard(
  entries: readonly DebugLogEntry[],
  formatTimestamp: (value: string | null | undefined) => string,
): string {
  return entries
    .map((entry) =>
      [
        formatTimestamp(entry.timestamp),
        `${entry.source.toUpperCase()} ${entry.level.toUpperCase()}`,
        entry.message,
        entry.details ?? '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

export function syncRetentionButtons(
  debugRetentionElement: HTMLElement | null,
  debugRetentionLimit: number,
): void {
  if (!debugRetentionElement) {
    return;
  }

  for (const button of Array.from(debugRetentionElement.querySelectorAll<HTMLButtonElement>('[data-retention]'))) {
    button.classList.toggle('retention-switch__button--active', Number(button.dataset.retention) === debugRetentionLimit);
  }
}

export function renderDebugLogs(options: {
  state: DebugRuntimeState;
  debugConsoleElement: HTMLElement | null;
  debugRetentionElement: HTMLElement | null;
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
}): void {
  if (!options.debugConsoleElement) {
    return;
  }

  syncRetentionButtons(options.debugRetentionElement, options.state.debugRetentionLimit);
  const visibleLogs = getVisibleDebugLogs(options.state);
  options.debugConsoleElement.innerHTML = renderDebugConsoleMarkup(
    {
      visibleLogs,
      debugFilterText: options.state.debugFilterText,
      debugRetentionLimit: options.state.debugRetentionLimit,
    },
    {
      escapeHtml: options.escapeHtml,
      formatTimestamp: options.formatTimestamp,
    },
  );

  if (visibleLogs.length) {
    options.debugConsoleElement.scrollTop = options.debugConsoleElement.scrollHeight;
  }
}
