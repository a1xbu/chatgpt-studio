import type { BottomPanelEventsHelpers } from './events';

export type BottomPanelControllerOptions = {
  findClosestHtmlElement: BottomPanelEventsHelpers['findClosestHtmlElement'];
  toggleBottomPanel: () => void;
  copyVisibleDebugLogs: () => Promise<void>;
  clearDebugLogs: () => Promise<void>;
  openEmbeddedTerminal: () => Promise<void>;
  closeTerminalSession: (sessionId: string) => Promise<void>;
  switchBottomTab: (nextTabId: string) => void;
  setDebugFilterText: (value: string) => void;
  setDebugRetentionLimit: (value: number) => void;
  renderDebugLogs: () => void;
  alert: (message: string) => void;
};

export function createBottomPanelEventHelpers(options: BottomPanelControllerOptions): BottomPanelEventsHelpers {
  return {
    findClosestHtmlElement: options.findClosestHtmlElement,
    toggleBottomPanel: options.toggleBottomPanel,
    copyVisibleDebugLogs: options.copyVisibleDebugLogs,
    clearDebugLogs: options.clearDebugLogs,
    openEmbeddedTerminal: options.openEmbeddedTerminal,
    closeTerminalSession: options.closeTerminalSession,
    switchBottomTab: options.switchBottomTab,
    setDebugFilterText: options.setDebugFilterText,
    setDebugRetentionLimit: options.setDebugRetentionLimit,
    renderDebugLogs: options.renderDebugLogs,
    showError: options.alert,
  };
}
