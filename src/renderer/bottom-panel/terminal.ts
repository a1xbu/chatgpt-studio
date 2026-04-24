import type { AppStateSnapshot } from '../../shared/contracts';
import type { TerminalSessionSnapshot, TerminalSessionState } from '../desktop-api';
import type { XtermFitAddon, XtermTerminal } from '../runtime-types';

export type BottomPanelTerminalUiState = {
  terminalInstance: XtermTerminal | null;
  terminalFitAddon: XtermFitAddon | null;
};

export type BottomPanelTerminalUiElements = {
  terminalHostElement: HTMLElement | null;
};

export type BottomPanelTerminalUiCallbacks = {
  getActiveTerminalSession: () => TerminalSessionState | null;
  writeTerminalInput: (sessionId: string, data: string) => void;
};

export type BottomPanelTerminalSessionsState = {
  activeBottomTabId: string;
  terminalSessions: TerminalSessionState[];
  renderedTerminalSessionId: string | null;
  renderedTerminalOutputLength: number;
  nextTerminalOrdinal: number;
};

export type CloseBottomPanelTerminalSessionResult = {
  nextState: BottomPanelTerminalSessionsState;
  didRemove: boolean;
  shouldResetTerminalViewport: boolean;
};

export type ScheduleBottomPanelTerminalFitOptions = {
  isScheduled: boolean;
  setScheduled: (value: boolean) => void;
  terminalInstance: XtermTerminal | null;
  terminalFitAddon: XtermFitAddon | null;
  terminalHostElement: HTMLElement | null;
  activeBottomTabId: string;
  isDebugPanelCollapsed: boolean;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  resizeVisibleTerminals: () => void;
};

export type CreateTerminalSessionStateResult = {
  sessionState: TerminalSessionState;
  nextTerminalOrdinal: number;
};

export function ensureBottomPanelTerminalUi(
  state: BottomPanelTerminalUiState,
  elements: BottomPanelTerminalUiElements,
  callbacks: BottomPanelTerminalUiCallbacks,
): BottomPanelTerminalUiState {
  if (state.terminalInstance || !elements.terminalHostElement || typeof Terminal === 'undefined' || typeof FitAddon === 'undefined') {
    return state;
  }

  const terminalInstance = new Terminal({
    cursorBlink: true,
    fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.25,
    theme: {
      background: '#17191c',
      foreground: '#d7dae0',
      cursor: '#7aa2ff',
      black: '#17191c',
      brightBlack: '#666d78',
      red: '#ef6b73',
      green: '#7cb66d',
      yellow: '#d9a441',
      blue: '#7aa2ff',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#f0f2f5',
    },
  });

  const terminalFitAddon = new FitAddon.FitAddon();
  terminalInstance.loadAddon(terminalFitAddon);
  terminalInstance.open(elements.terminalHostElement);
  terminalInstance.onData((data) => {
    const activeTerminal = callbacks.getActiveTerminalSession();
    if (!activeTerminal || activeTerminal.exited) {
      return;
    }

    callbacks.writeTerminalInput(activeTerminal.sessionId, data);
  });

  return {
    terminalInstance,
    terminalFitAddon,
  };
}

export function resizeVisibleTerminals(
  terminalInstance: Pick<XtermTerminal, 'cols' | 'rows'> | null,
  terminalSessions: readonly TerminalSessionState[],
  resizeTerminal: (sessionId: string, cols: number, rows: number) => void,
): void {
  if (!terminalInstance) {
    return;
  }

  const cols = terminalInstance.cols;
  const rows = terminalInstance.rows;

  for (const session of terminalSessions) {
    if (session.exited) {
      continue;
    }

    resizeTerminal(session.sessionId, cols, rows);
  }
}

export function scheduleBottomPanelTerminalFit(options: ScheduleBottomPanelTerminalFitOptions): void {
  if (options.isScheduled) {
    return;
  }

  options.setScheduled(true);
  options.requestAnimationFrame(() => {
    options.setScheduled(false);

    if (
      !options.terminalInstance
      || !options.terminalFitAddon
      || !options.terminalHostElement
      || options.activeBottomTabId === 'debug'
      || options.activeBottomTabId === 'git'
      || options.isDebugPanelCollapsed
    ) {
      return;
    }

    options.terminalFitAddon.fit();
    options.resizeVisibleTerminals();
  });
}

export function getCurrentProjectFolder(currentState: AppStateSnapshot | null): string | null {
  const currentProjectId = currentState?.lastContext?.currentProjectId ?? null;
  if (!currentProjectId || !currentState) {
    return null;
  }

  return currentState.persistentProjects.find((project) => project.projectId === currentProjectId)?.folderPath ?? null;
}

export function createTerminalSessionState(
  snapshot: TerminalSessionSnapshot,
  nextTerminalOrdinal: number,
): CreateTerminalSessionStateResult {
  return {
    sessionState: {
      ...snapshot,
      title: `Terminal ${nextTerminalOrdinal}`,
      outputBuffer: '',
      exited: false,
    },
    nextTerminalOrdinal: nextTerminalOrdinal + 1,
  };
}

export function openTerminalSessionState(
  state: BottomPanelTerminalSessionsState,
  snapshot: TerminalSessionSnapshot,
): BottomPanelTerminalSessionsState {
  const created = createTerminalSessionState(snapshot, state.nextTerminalOrdinal);
  return {
    ...state,
    terminalSessions: [...state.terminalSessions, created.sessionState],
    activeBottomTabId: created.sessionState.sessionId,
    renderedTerminalSessionId: null,
    renderedTerminalOutputLength: 0,
    nextTerminalOrdinal: created.nextTerminalOrdinal,
  };
}

export function closeTerminalSessionState(
  state: BottomPanelTerminalSessionsState,
  sessionId: string,
): CloseBottomPanelTerminalSessionResult {
  const currentIndex = state.terminalSessions.findIndex((session) => session.sessionId === sessionId);
  if (currentIndex < 0) {
    return {
      nextState: state,
      didRemove: false,
      shouldResetTerminalViewport: false,
    };
  }

  const wasActive = state.activeBottomTabId === sessionId;
  const terminalSessions = state.terminalSessions.filter((session) => session.sessionId !== sessionId);
  const shouldResetTerminalViewport = state.renderedTerminalSessionId === sessionId;

  let activeBottomTabId = state.activeBottomTabId;
  if (wasActive) {
    const fallbackSession = terminalSessions[currentIndex] ?? terminalSessions[currentIndex - 1] ?? null;
    activeBottomTabId = fallbackSession?.sessionId ?? 'debug';
  }

  return {
    nextState: {
      ...state,
      activeBottomTabId,
      terminalSessions,
      renderedTerminalSessionId: shouldResetTerminalViewport ? null : state.renderedTerminalSessionId,
      renderedTerminalOutputLength: shouldResetTerminalViewport ? 0 : state.renderedTerminalOutputLength,
    },
    didRemove: true,
    shouldResetTerminalViewport,
  };
}
