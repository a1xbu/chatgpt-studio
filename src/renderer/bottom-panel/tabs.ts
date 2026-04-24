export type BottomPanelTerminalSession = {
  sessionId: string;
  title: string;
  exited: boolean;
};

export type BottomPanelTabsViewModel = {
  activeBottomTabId: string;
  showGitTab: boolean;
  terminalSessions: readonly BottomPanelTerminalSession[];
};

export type BottomPanelTabsHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
};

export function buildTerminalTabLabel(session: BottomPanelTerminalSession): string {
  return session.exited ? `${session.title} (done)` : session.title;
}

export function buildBottomTabsMarkup(
  viewModel: BottomPanelTabsViewModel,
  helpers: BottomPanelTabsHelpers,
): string {
  const markup = [
    `
      <div class="bottom-tab ${viewModel.activeBottomTabId === 'debug' ? 'bottom-tab--active' : ''}">
        <button class="bottom-tab__button" data-tab-id="debug" type="button">
          <span class="bottom-tab__label">Debug Console</span>
        </button>
      </div>
    `,
    viewModel.showGitTab
      ? `
          <div class="bottom-tab ${viewModel.activeBottomTabId === 'git' ? 'bottom-tab--active' : ''}">
            <button class="bottom-tab__button" data-tab-id="git" type="button">
              <span class="bottom-tab__label">Git</span>
            </button>
          </div>
        `
      : '',
    ...viewModel.terminalSessions.map((session) => {
      const label = buildTerminalTabLabel(session);
      return `
        <div class="bottom-tab ${viewModel.activeBottomTabId === session.sessionId ? 'bottom-tab--active' : ''}">
          <button class="bottom-tab__button" data-tab-id="${helpers.escapeHtml(session.sessionId)}" title="${helpers.escapeHtml(label)}" type="button">
            <span class="bottom-tab__label">${helpers.escapeHtml(label)}</span>
          </button>
          <button
            class="bottom-tab__close"
            data-action="close-terminal"
            data-session-id="${helpers.escapeHtml(session.sessionId)}"
            title="Close ${helpers.escapeHtml(session.title)}"
            aria-label="Close ${helpers.escapeHtml(session.title)}"
            type="button"
          >
            x
          </button>
        </div>
      `;
    }),
  ];

  return markup.join('');
}
