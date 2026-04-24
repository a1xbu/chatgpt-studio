export type BrowserNavigationState = {
  browserCanGoBack: boolean;
  browserCanGoForward: boolean;
  browserIsLoading: boolean;
  pendingBrowserUrl: string | null;
};

export type WebviewElementLike = HTMLElement & {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getURL: () => string;
  goBack: () => void;
  goForward: () => void;
  isLoading: () => boolean;
  loadURL?: (url: string) => Promise<void> | void;
  reload: () => void;
  stop: () => void;
  setAttribute: (name: string, value: string) => void;
};

export type BrowserNavigationElements = {
  browserElement: WebviewElementLike | null;
  browserUrlElement: HTMLInputElement | null;
  backButton: HTMLButtonElement | null;
  forwardButton: HTMLButtonElement | null;
  refreshStopButton: HTMLButtonElement | null;
};

export type OpenBrowserUrlOptions = {
  activate?: boolean;
};

export type BrowserNavigationDependencies = {
  normalizeStoredUrl: (value: string | null | undefined) => string | null;
  onActivate?: () => void;
  onRenderActivatedView?: () => void;
  setTimeoutImpl?: (callback: () => void, delayMs: number) => number;
};

export function syncBrowserControls(
  state: BrowserNavigationState,
  elements: BrowserNavigationElements,
): void {
  if (elements.backButton) {
    elements.backButton.disabled = !state.browserCanGoBack;
  }

  if (elements.forwardButton) {
    elements.forwardButton.disabled = !state.browserCanGoForward;
  }

  if (elements.refreshStopButton) {
    elements.refreshStopButton.title = state.browserIsLoading ? 'Stop' : 'Refresh';
    elements.refreshStopButton.dataset.mode = state.browserIsLoading ? 'stop' : 'refresh';
    elements.refreshStopButton.setAttribute('aria-label', elements.refreshStopButton.title);
    elements.refreshStopButton.innerHTML = state.browserIsLoading
      ? `
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 5h6v6H5z" fill="currentColor" stroke="none" />
        </svg>
      `
      : `
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M12.5 6.5V3.5h-3M12 4a5 5 0 1 0 1 5" />
        </svg>
      `;
  }
}

export function updateBrowserUrl(
  browserUrlElement: HTMLInputElement | null,
  url: string | null | undefined,
): void {
  if (!browserUrlElement) {
    return;
  }

  browserUrlElement.value = url && url.trim() ? url : 'about:blank';
}

export function normalizeBrowserAddress(rawValue: string): string {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return 'https://chatgpt.com';
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

export function refreshBrowserNavigationState(
  state: BrowserNavigationState,
  elements: BrowserNavigationElements,
  normalizeStoredUrl: BrowserNavigationDependencies['normalizeStoredUrl'],
  nextUrl?: string | null,
): BrowserNavigationState {
  const { browserElement, browserUrlElement } = elements;
  if (!browserElement) {
    return state;
  }

  const nextState: BrowserNavigationState = {
    ...state,
    browserCanGoBack: typeof browserElement.canGoBack === 'function' ? browserElement.canGoBack() : false,
    browserCanGoForward: typeof browserElement.canGoForward === 'function' ? browserElement.canGoForward() : false,
    browserIsLoading: typeof browserElement.isLoading === 'function' ? browserElement.isLoading() : false,
  };

  updateBrowserUrl(
    browserUrlElement,
    nextUrl ?? (typeof browserElement.getURL === 'function' ? normalizeStoredUrl(browserElement.getURL()) : 'about:blank'),
  );
  syncBrowserControls(nextState, elements);
  return nextState;
}

export function openBrowserUrl(
  url: string,
  state: BrowserNavigationState,
  elements: BrowserNavigationElements,
  dependencies: BrowserNavigationDependencies,
  options: OpenBrowserUrlOptions = {},
): BrowserNavigationState {
  const { browserElement, browserUrlElement } = elements;
  if (!browserElement) {
    return state;
  }

  if (options.activate !== false) {
    dependencies.onActivate?.();
    dependencies.onRenderActivatedView?.();
  }

  const targetUrl = normalizeBrowserAddress(url);
  const nextState: BrowserNavigationState = {
    ...state,
    pendingBrowserUrl: targetUrl,
    browserIsLoading: true,
  };
  updateBrowserUrl(browserUrlElement, targetUrl);
  syncBrowserControls(nextState, elements);

  const currentUrl = typeof browserElement.getURL === 'function'
    ? dependencies.normalizeStoredUrl(browserElement.getURL())
    : null;
  if (currentUrl && currentUrl === targetUrl) {
    nextState.pendingBrowserUrl = null;
    nextState.browserIsLoading = typeof browserElement.isLoading === 'function' ? browserElement.isLoading() : false;
    return refreshBrowserNavigationState(nextState, elements, dependencies.normalizeStoredUrl, currentUrl);
  }

  if (
    typeof browserElement.stop === 'function'
    && typeof browserElement.isLoading === 'function'
    && browserElement.isLoading()
  ) {
    browserElement.stop();
  }

  browserElement.setAttribute('src', targetUrl);

  const setTimeoutImpl = dependencies.setTimeoutImpl ?? window.setTimeout.bind(window);
  setTimeoutImpl(() => {
    if (!elements.browserElement || nextState.pendingBrowserUrl !== targetUrl) {
      return;
    }

    const actualUrl = typeof elements.browserElement.getURL === 'function'
      ? dependencies.normalizeStoredUrl(elements.browserElement.getURL())
      : null;
    const stillLoading = typeof elements.browserElement.isLoading === 'function'
      ? elements.browserElement.isLoading()
      : false;
    if (actualUrl === targetUrl || stillLoading) {
      return;
    }

    if (typeof elements.browserElement.loadURL === 'function') {
      try {
        const navigation = elements.browserElement.loadURL(targetUrl);
        if (
          navigation
          && typeof navigation === 'object'
          && 'catch' in navigation
          && typeof navigation.catch === 'function'
        ) {
          void navigation.catch(() => {
            elements.browserElement?.setAttribute('src', targetUrl);
          });
        }
        return;
      } catch {
        elements.browserElement.setAttribute('src', targetUrl);
      }
    }
  }, 220);

  return nextState;
}
