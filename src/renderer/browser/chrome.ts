import type { WebviewElementLike } from './navigation';

export type BrowserChromeElements = {
  backButton: HTMLButtonElement | null;
  forwardButton: HTMLButtonElement | null;
  refreshStopButton: HTMLButtonElement | null;
  browserAddressFormElement: HTMLFormElement | null;
  browserUrlElement: HTMLInputElement | null;
  browserElement: WebviewElementLike | null;
};

export type BrowserChromeCallbacks = {
  normalizeBrowserAddress: (value: string) => string;
  openBrowserUrl: (url: string) => void;
};

export function bindBrowserChromeEvents(
  elements: BrowserChromeElements,
  callbacks: BrowserChromeCallbacks,
): void {
  elements.backButton?.addEventListener('click', () => {
    if (!elements.browserElement || elements.backButton?.disabled) {
      return;
    }

    elements.browserElement.goBack();
  });

  elements.forwardButton?.addEventListener('click', () => {
    if (!elements.browserElement || elements.forwardButton?.disabled) {
      return;
    }

    elements.browserElement.goForward();
  });

  elements.refreshStopButton?.addEventListener('click', () => {
    if (!elements.browserElement) {
      return;
    }

    if (elements.refreshStopButton?.dataset.mode === 'stop') {
      elements.browserElement.stop();
      return;
    }

    elements.browserElement.reload();
  });

  elements.browserAddressFormElement?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!elements.browserElement || !elements.browserUrlElement) {
      return;
    }

    const targetUrl = callbacks.normalizeBrowserAddress(elements.browserUrlElement.value);
    callbacks.openBrowserUrl(targetUrl);
  });
}
