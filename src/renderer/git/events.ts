
export type GitPanelEventsElements = {
  gitViewElement: HTMLElement | null;
};

export type GitPanelEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  refreshPanel: () => void;
  selectBranch: (branchName: string) => void;
  selectCommit: (commitHash: string) => void;
  toggleCommitDirectory: (commitHash: string, relativePath: string) => void;
};

export function bindGitPanelEvents(
  elements: GitPanelEventsElements,
  helpers: GitPanelEventsHelpers,
): void {
  elements.gitViewElement?.addEventListener('click', (event) => {
    const refreshButton = helpers.findClosestHtmlElement(event.target, '[data-action="refresh-git-panel"]');
    if (refreshButton) {
      helpers.refreshPanel();
      return;
    }

    const branchButton = helpers.findClosestHtmlElement(event.target, '[data-action="select-git-branch"]');
    if (branchButton) {
      const branchName = branchButton.dataset.branchName ?? '';
      if (branchName) {
        helpers.selectBranch(branchName);
      }
      return;
    }

    const commitButton = helpers.findClosestHtmlElement(event.target, '[data-action="select-git-commit"]');
    if (commitButton) {
      const commitHash = commitButton.dataset.commitHash ?? '';
      if (commitHash) {
        helpers.selectCommit(commitHash);
      }
      return;
    }

    const toggleDirectoryRow = helpers.findClosestHtmlElement(event.target, '[data-action="toggle-git-commit-directory"]');
    if (!toggleDirectoryRow) {
      return;
    }

    const commitHash = toggleDirectoryRow.dataset.commitHash ?? '';
    const relativePath = toggleDirectoryRow.dataset.relativePath ?? '';
    if (commitHash && relativePath) {
      helpers.toggleCommitDirectory(commitHash, relativePath);
    }
  });
}
