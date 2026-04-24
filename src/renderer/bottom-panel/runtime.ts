import type { AppStateSnapshot } from '../../shared/contracts';
import type { TerminalSessionSnapshot, TerminalSessionState } from '../desktop-api';
import type { XtermFitAddon, XtermTerminal } from '../runtime-types';
import {
  closeTerminalSessionState,
  getCurrentProjectFolder,
  openTerminalSessionState,
  type BottomPanelTerminalSessionsState,
} from './terminal';

export type BottomPanelRuntimeState = BottomPanelTerminalSessionsState & {
  isDebugPanelCollapsed: boolean;
};

export type BottomPanelRuntimeStateSetter = (nextState: BottomPanelRuntimeState) => void;

export type BottomPanelRuntimeTerminalUi = {
  ensureTerminalUi: () => void;
  getTerminalInstance: () => XtermTerminal | null;
  getTerminalFitAddon: () => XtermFitAddon | null;
  focusTerminal: () => void;
  resetTerminalViewport: () => void;
};

export type BottomPanelRuntimeRenderCallbacks = {
  applyDebugPanelState: () => void;
  renderBottomPanel: () => void;
  scheduleTerminalFit: () => void;
  syncActiveTerminalViewport: (force?: boolean) => void;
};

export type BottomPanelRuntimeDesktopApi = {
  startTerminal: (cwd: string | null, cols: number, rows: number) => Promise<TerminalSessionSnapshot>;
  closeTerminal: (sessionId: string) => Promise<void>;
};

export type OpenEmbeddedTerminalOptions = {
  getState: () => BottomPanelRuntimeState;
  currentState: AppStateSnapshot | null;
  setState: BottomPanelRuntimeStateSetter;
  terminalUi: BottomPanelRuntimeTerminalUi;
  renderCallbacks: BottomPanelRuntimeRenderCallbacks;
  desktopApi: Pick<BottomPanelRuntimeDesktopApi, 'startTerminal'>;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
};

export type CloseEmbeddedTerminalOptions = {
  sessionId: string;
  getState: () => BottomPanelRuntimeState;
  setState: BottomPanelRuntimeStateSetter;
  terminalUi: BottomPanelRuntimeTerminalUi;
  renderCallbacks: BottomPanelRuntimeRenderCallbacks;
  desktopApi: Pick<BottomPanelRuntimeDesktopApi, 'closeTerminal'>;
};

export type SwitchBottomTabOptions = {
  nextTabId: string;
  state: BottomPanelRuntimeState;
  setState: BottomPanelRuntimeStateSetter;
  renderBottomPanel: () => void;
  syncActiveTerminalViewport: (force?: boolean) => void;
  scheduleTerminalFit: () => void;
  focusTerminal: () => void;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
};

export function switchBottomTab(options: SwitchBottomTabOptions): void {
  options.setState({
    ...options.state,
    activeBottomTabId: options.nextTabId,
  });
  options.renderBottomPanel();

  if (options.nextTabId !== 'debug' && options.nextTabId !== 'git') {
    options.requestAnimationFrame(() => {
      options.syncActiveTerminalViewport(true);
      options.scheduleTerminalFit();
      options.focusTerminal();
    });
  }
}

export async function openEmbeddedTerminal(options: OpenEmbeddedTerminalOptions): Promise<void> {
  let nextState = options.getState();
  if (nextState.isDebugPanelCollapsed) {
    nextState = {
      ...nextState,
      isDebugPanelCollapsed: false,
    };
    options.setState(nextState);
    options.renderCallbacks.applyDebugPanelState();
  }

  options.terminalUi.ensureTerminalUi();

  await new Promise<void>((resolve) => {
    options.requestAnimationFrame(() => resolve());
  });

  options.terminalUi.getTerminalFitAddon()?.fit();
  const terminalInstance = options.terminalUi.getTerminalInstance();
  const cols = terminalInstance?.cols ?? 100;
  const rows = terminalInstance?.rows ?? 24;
  const snapshot = await options.desktopApi.startTerminal(getCurrentProjectFolder(options.currentState), cols, rows);

  nextState = options.getState();
  nextState = {
    ...nextState,
    ...openTerminalSessionState(nextState, snapshot),
  };
  options.setState(nextState);
  options.renderCallbacks.renderBottomPanel();
  options.renderCallbacks.scheduleTerminalFit();
  options.terminalUi.focusTerminal();
}

export async function closeEmbeddedTerminal(options: CloseEmbeddedTerminalOptions): Promise<void> {
  const previousState = options.getState();
  const closeResult = closeTerminalSessionState(previousState, options.sessionId);
  if (!closeResult.didRemove) {
    return;
  }

  const nextState: BottomPanelRuntimeState = {
    ...previousState,
    ...closeResult.nextState,
  };
  options.setState(nextState);

  if (closeResult.shouldResetTerminalViewport) {
    options.terminalUi.resetTerminalViewport();
  }

  options.renderCallbacks.renderBottomPanel();

  try {
    await options.desktopApi.closeTerminal(options.sessionId);
  } catch (error) {
    options.setState(previousState);
    options.renderCallbacks.renderBottomPanel();

    if (previousState.renderedTerminalSessionId && previousState.activeBottomTabId !== 'debug' && previousState.activeBottomTabId !== 'git') {
      options.renderCallbacks.syncActiveTerminalViewport(true);
    }

    throw error;
  }

  const currentState = options.getState();
  if (currentState.activeBottomTabId !== 'debug' && currentState.activeBottomTabId !== 'git') {
    options.renderCallbacks.syncActiveTerminalViewport(true);
  }
}
