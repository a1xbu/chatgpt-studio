export type BottomPanelTerminalSessionState = {
  sessionId: string;
  cwd: string | null;
  shell: string;
  outputBuffer: string;
  exited: boolean;
  title: string;
};

export type XtermTerminalLike = {
  clear: () => void;
  reset: () => void;
  write: (data: string) => void;
};

export type BottomPanelRuntimeState = {
  activeBottomTabId: string;
  terminalSessions: BottomPanelTerminalSessionState[];
  isDebugPanelCollapsed: boolean;
  renderedTerminalSessionId: string | null;
  renderedTerminalOutputLength: number;
};

export type BottomPanelElements = {
  debugViewElement: HTMLElement | null;
  terminalViewElement: HTMLElement | null;
  gitViewElement: HTMLElement | null;
  terminalPaneElement: HTMLElement | null;
  terminalEmptyElement: HTMLElement | null;
  terminalMetaElement: HTMLElement | null;
  terminalInstance: XtermTerminalLike | null;
};

export type BottomPanelRenderHelpers = {
  shouldRenderGitTab: () => boolean;
  renderBottomTabs: () => void;
  renderGitPanel: () => void;
  ensureTerminalUi: () => XtermTerminalLike | null;
  scheduleTerminalFit: () => void;
};

export function getTerminalSession(
  sessionId: string,
  terminalSessions: readonly BottomPanelTerminalSessionState[],
): BottomPanelTerminalSessionState | undefined {
  return terminalSessions.find((session) => session.sessionId === sessionId);
}

export function getActiveTerminalSession(
  state: Pick<BottomPanelRuntimeState, 'activeBottomTabId' | 'terminalSessions'>,
): BottomPanelTerminalSessionState | null {
  if (state.activeBottomTabId === 'debug' || state.activeBottomTabId === 'git') {
    return null;
  }

  return getTerminalSession(state.activeBottomTabId, state.terminalSessions) ?? null;
}

export function syncActiveTerminalViewport(
  state: BottomPanelRuntimeState,
  terminalInstance: XtermTerminalLike | null,
  force = false,
): BottomPanelRuntimeState {
  const activeSession = getActiveTerminalSession(state);
  if (!activeSession || !terminalInstance || state.isDebugPanelCollapsed) {
    return state;
  }

  if (force || state.renderedTerminalSessionId !== activeSession.sessionId) {
    terminalInstance.reset();
    terminalInstance.clear();
    if (activeSession.outputBuffer) {
      terminalInstance.write(activeSession.outputBuffer);
    }
    return {
      ...state,
      renderedTerminalSessionId: activeSession.sessionId,
      renderedTerminalOutputLength: activeSession.outputBuffer.length,
    };
  }

  if (state.renderedTerminalOutputLength > activeSession.outputBuffer.length) {
    terminalInstance.reset();
    terminalInstance.clear();
    terminalInstance.write(activeSession.outputBuffer);
    return {
      ...state,
      renderedTerminalOutputLength: activeSession.outputBuffer.length,
    };
  }

  const nextChunk = activeSession.outputBuffer.slice(state.renderedTerminalOutputLength);
  if (!nextChunk) {
    return state;
  }

  terminalInstance.write(nextChunk);
  return {
    ...state,
    renderedTerminalOutputLength: activeSession.outputBuffer.length,
  };
}

export function renderBottomPanel(
  state: BottomPanelRuntimeState,
  elements: BottomPanelElements,
  helpers: BottomPanelRenderHelpers,
): BottomPanelRuntimeState {
  let nextState = { ...state };

  if (nextState.activeBottomTabId === 'git' && !helpers.shouldRenderGitTab()) {
    nextState.activeBottomTabId = 'debug';
  }

  if (
    nextState.activeBottomTabId !== 'debug'
    && nextState.activeBottomTabId !== 'git'
    && !getTerminalSession(nextState.activeBottomTabId, nextState.terminalSessions)
  ) {
    nextState.activeBottomTabId = 'debug';
  }

  helpers.renderBottomTabs();

  const activeTerminal = getActiveTerminalSession(nextState);
  const isDebugTabActive = nextState.activeBottomTabId === 'debug';
  const isGitTabActive = nextState.activeBottomTabId === 'git';
  elements.debugViewElement?.classList.toggle('bottom-panel-view--active', isDebugTabActive);
  elements.terminalViewElement?.classList.toggle('bottom-panel-view--active', !isDebugTabActive && !isGitTabActive);
  elements.gitViewElement?.classList.toggle('bottom-panel-view--active', isGitTabActive);
  elements.terminalPaneElement?.classList.toggle('terminal-pane--ready', Boolean(activeTerminal));

  if (elements.terminalEmptyElement) {
    elements.terminalEmptyElement.innerHTML = nextState.terminalSessions.length
      ? `Select a terminal tab to resume that shell.`
      : `Click the terminal button in the tab bar to start an embedded shell in the current project folder.`;
  }

  if (elements.terminalMetaElement) {
    elements.terminalMetaElement.textContent = activeTerminal
      ? `${activeTerminal.shell}${activeTerminal.cwd ? ` - ${activeTerminal.cwd}` : ''}${activeTerminal.exited ? ' - exited' : ''}`
      : 'No terminal selected';
  }

  if (isGitTabActive) {
    helpers.renderGitPanel();
  }

  if (!isDebugTabActive && !isGitTabActive) {
    const ensuredTerminalInstance = helpers.ensureTerminalUi();
    nextState = syncActiveTerminalViewport(
      nextState,
      ensuredTerminalInstance ?? elements.terminalInstance,
      nextState.renderedTerminalSessionId !== activeTerminal?.sessionId,
    );
  }

  helpers.scheduleTerminalFit();
  return nextState;
}
