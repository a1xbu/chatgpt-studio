import type { AppStateSnapshot, DebugLogEntry } from '../../shared/contracts';
import { bindBrowserWebviewEvents } from '../browser/webview-events';
import type {
  ChatHistoryUpdatePayload,
  DesktopPocApi,
  TerminalDataPayload,
  TerminalExitPayload,
} from '../desktop-api';
import type { WebviewElement } from '../runtime-types';

export type RuntimeSubscriptionOptions = {
  desktopPoc: Pick<DesktopPocApi, 'onStateChanged' | 'onDebugEntry' | 'onChatHistoryUpdated' | 'onTerminalData' | 'onTerminalExit'>;
  browserElement: WebviewElement;
  handleDesktopStateChanged: (state: AppStateSnapshot) => void;
  handleDebugEntry: (entry: DebugLogEntry) => void;
  handleChatHistoryUpdated: (payload: ChatHistoryUpdatePayload) => void;
  handleBrowserDidStartLoading: () => void;
  handleBrowserDidFinishLoad: () => void;
  handleBrowserDidStopLoading: (url: string | null | undefined) => void;
  handleBrowserDidFailLoad: (payload: { errorCode?: number; errorDescription?: string; validatedURL?: string }) => void;
  handleBrowserDidNavigate: (url: string | null | undefined) => void;
  handleBrowserDomReady: () => void;
  handleBrowserSandboxFileStatus: (payload: unknown) => void;
  handleTerminalData: (payload: TerminalDataPayload) => void;
  handleTerminalExit: (payload: TerminalExitPayload) => void;
  addDebugLog: (source: DebugLogEntry['source'], level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
  handleResize: () => void;
};

export function bindRendererRuntimeSubscriptions(options: RuntimeSubscriptionOptions): void {
  bindBrowserWebviewEvents(
    {
      browserElement: options.browserElement,
    },
    {
      onDidStartLoading: () => {
        options.handleBrowserDidStartLoading();
      },
      onDidFinishLoad: () => {
        options.handleBrowserDidFinishLoad();
      },
      onDidStopLoading: (url) => {
        options.handleBrowserDidStopLoading(url);
      },
      onDidFailLoad: (payload) => {
        options.handleBrowserDidFailLoad(payload);
      },
      onConsoleMessage: (payload) => {
        const level = payload.level === 2 ? 'warn' : payload.level === 3 ? 'error' : 'info';
        options.addDebugLog(
          'webview',
          level,
          payload.message ?? 'Webview console message',
          payload.sourceId ? `${payload.sourceId}:${String(payload.line ?? '')}` : null,
        );
      },
      onDidNavigate: (url) => {
        options.handleBrowserDidNavigate(url);
      },
      onDomReady: () => {
        options.handleBrowserDomReady();
      },
      onIpcMessage: (payload) => {
        if (payload.channel === 'chatgpt-file:status') {
          options.handleBrowserSandboxFileStatus(payload.args?.[0]);
        }
      },
    },
  );

  options.desktopPoc.onStateChanged((state) => {
    options.handleDesktopStateChanged(state);
  });

  options.desktopPoc.onDebugEntry((entry) => {
    options.handleDebugEntry(entry);
  });

  options.desktopPoc.onChatHistoryUpdated((payload) => {
    options.handleChatHistoryUpdated(payload);
  });

  options.desktopPoc.onTerminalData((payload) => {
    options.handleTerminalData(payload);
  });

  options.desktopPoc.onTerminalExit((payload) => {
    options.handleTerminalExit(payload);
  });

  window.addEventListener('resize', options.handleResize);
}
