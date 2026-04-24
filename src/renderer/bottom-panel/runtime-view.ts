import type { TerminalSessionState } from '../desktop-api';
import type { XtermFitAddon, XtermTerminal } from '../runtime-types';
import { buildBottomTabsMarkup } from './tabs';
import {
  getActiveTerminalSession as getActiveTerminalSessionImpl,
  getTerminalSession as getTerminalSessionImpl,
  renderBottomPanel as renderBottomPanelImpl,
  syncActiveTerminalViewport as syncActiveTerminalViewportImpl,
} from './view';
import {
  ensureBottomPanelTerminalUi as ensureBottomPanelTerminalUiImpl,
  resizeVisibleTerminals as resizeVisibleTerminalsImpl,
  scheduleBottomPanelTerminalFit as scheduleBottomPanelTerminalFitImpl,
} from './terminal';

export type BottomPanelTerminalViewportState = {
  activeBottomTabId: string;
  terminalSessions: TerminalSessionState[];
  isDebugPanelCollapsed: boolean;
  renderedTerminalSessionId: string | null;
  renderedTerminalOutputLength: number;
};

export type BottomPanelTerminalUiState = {
  terminalInstance: XtermTerminal | null;
  terminalFitAddon: XtermFitAddon | null;
};

export function getTerminalSession(
  sessionId: string,
  terminalSessions: readonly TerminalSessionState[],
): TerminalSessionState | undefined {
  return getTerminalSessionImpl(sessionId, terminalSessions);
}

export function getActiveTerminalSession(state: Pick<BottomPanelTerminalViewportState, 'activeBottomTabId' | 'terminalSessions'>): TerminalSessionState | null {
  return getActiveTerminalSessionImpl(state) as TerminalSessionState | null;
}

export function ensureTerminalUi(
  state: BottomPanelTerminalUiState,
  elements: { terminalHostElement: HTMLElement | null },
  callbacks: {
    getActiveTerminalSession: () => TerminalSessionState | null;
    writeTerminalInput: (sessionId: string, data: string) => void;
  },
): BottomPanelTerminalUiState {
  return ensureBottomPanelTerminalUiImpl(state, elements, callbacks);
}

export function resizeVisibleTerminals(
  terminalInstance: XtermTerminal | null,
  terminalSessions: readonly TerminalSessionState[],
  resizeTerminal: (sessionId: string, cols: number, rows: number) => void,
): void {
  resizeVisibleTerminalsImpl(terminalInstance, terminalSessions, resizeTerminal);
}

export function scheduleTerminalFit(options: {
  isScheduled: boolean;
  setScheduled: (value: boolean) => void;
  terminalInstance: XtermTerminal | null;
  terminalFitAddon: XtermFitAddon | null;
  terminalHostElement: HTMLElement | null;
  activeBottomTabId: string;
  isDebugPanelCollapsed: boolean;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  resizeVisibleTerminals: () => void;
}): void {
  scheduleBottomPanelTerminalFitImpl(options);
}

export function renderBottomTabs(options: {
  bottomTabsElement: HTMLElement | null;
  activeBottomTabId: string;
  terminalSessions: TerminalSessionState[];
  showGitTab: boolean;
  escapeHtml: (value: string | null | undefined) => string;
}): void {
  if (!options.bottomTabsElement) {
    return;
  }

  options.bottomTabsElement.innerHTML = buildBottomTabsMarkup(
    {
      activeBottomTabId: options.activeBottomTabId,
      showGitTab: options.showGitTab,
      terminalSessions: options.terminalSessions,
    },
    { escapeHtml: options.escapeHtml },
  );
}

export function syncTerminalViewport(
  state: BottomPanelTerminalViewportState,
  terminalInstance: XtermTerminal | null,
  force = false,
): BottomPanelTerminalViewportState {
  return syncActiveTerminalViewportImpl(state, terminalInstance, force) as BottomPanelTerminalViewportState;
}

export function renderBottomPanel(options: {
  state: BottomPanelTerminalViewportState;
  elements: {
    debugViewElement: HTMLElement | null;
    terminalViewElement: HTMLElement | null;
    gitViewElement: HTMLElement | null;
    terminalPaneElement: HTMLElement | null;
    terminalEmptyElement: HTMLElement | null;
    terminalMetaElement: HTMLElement | null;
    terminalInstance: XtermTerminal | null;
  };
  helpers: {
    shouldRenderGitTab: () => boolean;
    renderBottomTabs: () => void;
    renderGitPanel: () => void;
    ensureTerminalUi: () => XtermTerminal | null;
    scheduleTerminalFit: () => void;
  };
}): BottomPanelTerminalViewportState {
  return renderBottomPanelImpl(options.state, options.elements, options.helpers) as BottomPanelTerminalViewportState;
}
