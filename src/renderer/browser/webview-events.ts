import type { WebviewElementLike } from './navigation';

export type BrowserWebviewBindings = {
  browserElement: WebviewElementLike | null;
};

export type BrowserWebviewCallbacks = {
  onDidStartLoading: () => void;
  onDidFinishLoad: () => void;
  onDidStopLoading: (url: string | null | undefined) => void;
  onDidFailLoad: (payload: { errorCode?: number; errorDescription?: string; validatedURL?: string }) => void;
  onConsoleMessage: (payload: { level?: number; message?: string; sourceId?: string; line?: number }) => void;
  onDidNavigate: (url: string | null | undefined) => void;
  onDomReady: () => void;
  onIpcMessage: (payload: { channel?: string; args?: unknown[] }) => void;
};

export function bindBrowserWebviewEvents(
  bindings: BrowserWebviewBindings,
  callbacks: BrowserWebviewCallbacks,
): void {
  const { browserElement } = bindings;
  if (!browserElement) {
    return;
  }

  browserElement.addEventListener('did-start-loading', () => {
    callbacks.onDidStartLoading();
  });

  browserElement.addEventListener('did-finish-load', () => {
    callbacks.onDidFinishLoad();
  });

  browserElement.addEventListener('did-stop-loading', (event: Event) => {
    const typedEvent = event as Event & { validatedURL?: string };
    callbacks.onDidStopLoading(typedEvent.validatedURL);
  });

  browserElement.addEventListener('did-fail-load', (event: Event) => {
    const typedEvent = event as Event & {
      errorCode?: number;
      errorDescription?: string;
      validatedURL?: string;
    };
    callbacks.onDidFailLoad(typedEvent);
  });

  browserElement.addEventListener('console-message', (event: Event) => {
    const typedEvent = event as Event & {
      level?: number;
      message?: string;
      sourceId?: string;
      line?: number;
    };
    callbacks.onConsoleMessage(typedEvent);
  });

  browserElement.addEventListener('did-navigate', (event: Event) => {
    const typedEvent = event as Event & { url?: string };
    callbacks.onDidNavigate(typedEvent.url);
  });

  browserElement.addEventListener('did-navigate-in-page', (event: Event) => {
    const typedEvent = event as Event & { url?: string };
    callbacks.onDidNavigate(typedEvent.url);
  });

  browserElement.addEventListener('dom-ready', () => {
    callbacks.onDomReady();
  });

  browserElement.addEventListener('ipc-message', (event: Event) => {
    const typedEvent = event as Event & { channel?: string; args?: unknown[] };
    callbacks.onIpcMessage(typedEvent);
  });
}
