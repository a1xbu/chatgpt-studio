import type { GitPanelEventsHelpers } from './events';

export type GitPanelControllerOptions = {
  findClosestHtmlElement: GitPanelEventsHelpers['findClosestHtmlElement'];
  getGitPanelProjectId: () => string | null;
  getSelectedRefName: () => string | null;
  setSelectedBranchName: (branchName: string | null) => void;
  getSelectedCommitHash: () => string | null;
  setSelectedCommitHash: (commitHash: string | null) => void;
  clearCommitDetailsState: (isLoading: boolean) => void;
  refreshGitPanel: (projectId: string, refName?: string | null) => Promise<void>;
  renderBottomPanel: () => void;
  setGitPanelLoadError: (message: string | null) => void;
  renderGitPanel: () => void;
  refreshGitCommitDetails: (projectId: string, commitHash: string) => Promise<void>;
  getGitCommitDirectoryKey: (commitHash: string, relativePath?: string) => string;
  collapsedGitCommitDirectoryKeys: Set<string>;
};

export function createGitPanelEventHelpers(options: GitPanelControllerOptions): GitPanelEventsHelpers {
  return {
    findClosestHtmlElement: options.findClosestHtmlElement,
    refreshPanel: () => {
      const projectId = options.getGitPanelProjectId();
      if (!projectId) {
        return;
      }

      void options.refreshGitPanel(projectId, options.getSelectedRefName()).catch((error: unknown) => {
        options.setGitPanelLoadError(error instanceof Error ? error.message : String(error));
        options.renderBottomPanel();
      });
    },
    selectBranch: (branchName) => {
      const projectId = options.getGitPanelProjectId();
      if (!projectId) {
        return;
      }

      options.setSelectedBranchName(branchName);
      options.setSelectedCommitHash(null);
      options.clearCommitDetailsState(false);
      void options.refreshGitPanel(projectId, branchName).catch((error: unknown) => {
        options.setGitPanelLoadError(error instanceof Error ? error.message : String(error));
        options.renderBottomPanel();
      });
    },
    selectCommit: (commitHash) => {
      const projectId = options.getGitPanelProjectId();
      if (!projectId || commitHash === options.getSelectedCommitHash()) {
        return;
      }

      options.setSelectedCommitHash(commitHash);
      options.clearCommitDetailsState(true);
      options.renderGitPanel();
      void options.refreshGitCommitDetails(projectId, commitHash);
    },
    toggleCommitDirectory: (commitHash, relativePath) => {
      const key = options.getGitCommitDirectoryKey(commitHash, relativePath);
      if (options.collapsedGitCommitDirectoryKeys.has(key)) {
        options.collapsedGitCommitDirectoryKeys.delete(key);
      } else {
        options.collapsedGitCommitDirectoryKeys.add(key);
      }
      options.renderGitPanel();
    },
  };
}
