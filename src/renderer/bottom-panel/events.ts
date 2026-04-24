
export type BottomPanelEventsElements = {
  toggleBottomPanelButton: HTMLElement | null;
  copyDebugButton: HTMLElement | null;
  clearDebugButton: HTMLElement | null;
  openTerminalButton: HTMLElement | null;
  bottomTabsElement: HTMLElement | null;
  debugFilterInputElement: HTMLInputElement | null;
  debugRetentionElement: HTMLElement | null;
};

export type BottomPanelEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  toggleBottomPanel: () => void;
  copyVisibleDebugLogs: () => Promise<void>;
  clearDebugLogs: () => Promise<void>;
  openEmbeddedTerminal: () => Promise<void>;
  closeTerminalSession: (sessionId: string) => Promise<void>;
  switchBottomTab: (nextTabId: string) => void;
  setDebugFilterText: (value: string) => void;
  setDebugRetentionLimit: (value: number) => void;
  renderDebugLogs: () => void;
  showError: (message: string) => void;
};

export function bindBottomPanelEvents(
  elements: BottomPanelEventsElements,
  helpers: BottomPanelEventsHelpers,
): void {
  elements.toggleBottomPanelButton?.addEventListener('click', () => {
    helpers.toggleBottomPanel();
  });

  elements.copyDebugButton?.addEventListener('click', () => {
    void helpers.copyVisibleDebugLogs().catch((error: unknown) => {
      helpers.showError(error instanceof Error ? error.message : String(error));
    });
  });

  elements.clearDebugButton?.addEventListener('click', () => {
    void helpers.clearDebugLogs().catch((error: unknown) => {
      helpers.showError(error instanceof Error ? error.message : String(error));
    });
  });

  elements.openTerminalButton?.addEventListener('click', () => {
    void helpers.openEmbeddedTerminal().catch((error: unknown) => {
      helpers.showError(error instanceof Error ? error.message : String(error));
    });
  });

  elements.bottomTabsElement?.addEventListener('click', (event) => {
    const closeButton = helpers.findClosestHtmlElement(event.target, '[data-action="close-terminal"]');
    if (closeButton) {
      const sessionId = closeButton.dataset.sessionId ?? '';
      if (!sessionId) {
        return;
      }

      void helpers.closeTerminalSession(sessionId).catch((error: unknown) => {
        helpers.showError(error instanceof Error ? error.message : String(error));
      });
      return;
    }

    const tabButton = helpers.findClosestHtmlElement(event.target, '[data-tab-id]');
    if (!tabButton) {
      return;
    }

    helpers.switchBottomTab(tabButton.dataset.tabId ?? 'debug');
  });

  elements.debugFilterInputElement?.addEventListener('input', () => {
    helpers.setDebugFilterText(elements.debugFilterInputElement?.value ?? '');
    helpers.renderDebugLogs();
  });

  elements.debugRetentionElement?.addEventListener('click', (event) => {
    const button = helpers.findClosestHtmlElement(event.target, '[data-retention]') as HTMLButtonElement | null;
    if (!button) {
      return;
    }

    helpers.setDebugRetentionLimit(Number(button.dataset.retention) === 1000 ? 1000 : 100);
    helpers.renderDebugLogs();
  });
}
