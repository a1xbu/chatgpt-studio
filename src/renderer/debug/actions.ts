import type { DebugLogEntry } from '../../shared/contracts';

export type PushDebugLogOptions = {
  getDebugLogs: () => DebugLogEntry[];
  setDebugLogs: (entries: DebugLogEntry[]) => void;
  maxDebugLogs: number;
  renderDebugLogs: () => void;
};

export function pushDebugLog(entry: DebugLogEntry, options: PushDebugLogOptions): void {
  options.setDebugLogs([...options.getDebugLogs(), entry].slice(-options.maxDebugLogs));
  options.renderDebugLogs();
}

export type AddDebugLogOptions = PushDebugLogOptions & {
  createTimestamp?: () => string;
  createRandomId?: () => string;
};

export function addDebugLog(
  source: DebugLogEntry['source'],
  level: DebugLogEntry['level'],
  message: string,
  details: string | null = null,
  options: AddDebugLogOptions,
): void {
  pushDebugLog(
    {
      id: `renderer-debug-${(options.createTimestamp ?? (() => Date.now().toString()))()}-${(options.createRandomId ?? (() => Math.random().toString(36).slice(2, 8)))()}`,
      level,
      message,
      details,
      source,
      timestamp: (options.createTimestamp ?? (() => new Date().toISOString()))(),
    },
    options,
  );
}

export type CopyVisibleDebugLogsOptions = {
  getVisibleDebugLogs: () => DebugLogEntry[];
  formatDebugLogsForClipboard: (entries: DebugLogEntry[]) => string;
  copyTextToClipboard: (text: string, clipboard: Clipboard | undefined, documentLike: Document) => Promise<void>;
  clipboard: Clipboard | undefined;
  documentLike: Document;
};

export async function copyVisibleDebugLogs(options: CopyVisibleDebugLogsOptions): Promise<void> {
  const visibleLogs = options.getVisibleDebugLogs();
  if (!visibleLogs.length) {
    return;
  }

  await options.copyTextToClipboard(options.formatDebugLogsForClipboard(visibleLogs), options.clipboard, options.documentLike);
}

export type ClearDebugLogsOptions = {
  setDebugLogs: (entries: DebugLogEntry[]) => void;
  renderDebugLogs: () => void;
  clearDebugLogs: () => Promise<unknown>;
};

export async function clearDebugLogs(options: ClearDebugLogsOptions): Promise<void> {
  options.setDebugLogs([]);
  options.renderDebugLogs();
  await options.clearDebugLogs();
}
