import type { WebviewElementLike } from './browser/navigation';

export type WebviewElement = WebviewElementLike & {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getURL: () => string;
  goBack: () => void;
  goForward: () => void;
  isLoading: () => boolean;
  loadURL?: (url: string) => Promise<void> | void;
  reload: () => void;
  stop: () => void;
  send?: (channel: string, ...args: unknown[]) => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

export type FileDownloadRuntimeStatus = {
  projectId: string;
  chatId: string;
  messageId: string;
  sandboxPath: string;
  fileName: string | null;
  status: 'waiting' | 'resolving' | 'downloading' | 'saving' | 'downloaded' | 'cancelled' | 'error';
  progressPercent: number | null;
  message: string | null;
  downloadPath: string | null;
  updatedAt: string;
};

export type XtermTerminal = {
  clear: () => void;
  dispose: () => void;
  focus: () => void;
  loadAddon: (addon: unknown) => void;
  onData: (listener: (data: string) => void) => void;
  open: (element: HTMLElement) => void;
  reset: () => void;
  resize: (cols: number, rows: number) => void;
  write: (data: string) => void;
  cols: number;
  rows: number;
};

export type XtermFitAddon = {
  fit: () => void;
};

export type MarkdownItInstance = {
  render: (source: string) => string;
  renderInline: (source: string) => string;
};
