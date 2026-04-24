import type { AppStateSnapshot, SidebarProject } from '../../shared/contracts';
import { renderGitPanelMarkup } from './panel';
import type { GitFileTreeNode } from './git-file-tree';
import type { GitCommitDetails, GitCommitDetailsResult, GitOverviewResult, GitRepositoryOverview } from './types';

export type GitRuntimeState = {
  activeBottomTabId: string;
  gitPanelProjectId: string | null;
  gitPanelSelectedRefName: string | null;
  gitPanelOverview: GitRepositoryOverview | null;
  gitPanelLoadError: string | null;
  gitPanelLoadingRequest: number;
  gitPanelIsLoading: boolean;
  selectedGitBranchName: string | null;
  selectedGitCommitHash: string | null;
  gitCommitDetails: GitCommitDetails | null;
  gitCommitDetailsError: string | null;
  gitCommitDetailsIsLoading: boolean;
  gitCommitDetailsLoadingRequest: number;
};

export type GitRuntimeStateSetter = (nextState: GitRuntimeState) => void;

export type GitRuntimeSelectionHelpers = {
  getActiveSidebarProject: (state: AppStateSnapshot) => SidebarProject | null;
};

export type RefreshGitCommitDetailsOptions = {
  projectId: string;
  commitHash: string | null;
  getState: () => GitRuntimeState;
  setState: GitRuntimeStateSetter;
  renderBottomPanel: () => void;
  getGitCommitDetails: (projectId: string, commitHash: string) => Promise<GitCommitDetailsResult>;
};

export type RefreshGitPanelOptions = {
  projectId: string;
  refName?: string | null;
  getState: () => GitRuntimeState;
  setState: GitRuntimeStateSetter;
  renderBottomPanel: () => void;
  getGitOverview: (projectId: string, refName?: string | null) => Promise<GitOverviewResult>;
  refreshGitCommitDetails: (projectId: string, commitHash: string | null) => Promise<void>;
};

export type SyncGitPanelWithCurrentProjectOptions = {
  currentState: AppStateSnapshot | null;
  getState: () => GitRuntimeState;
  setState: GitRuntimeStateSetter;
  refreshGitPanel: (projectId: string, refName?: string | null) => Promise<void>;
} & GitRuntimeSelectionHelpers;

export type RenderGitPanelOptions = {
  currentState: AppStateSnapshot | null;
  state: GitRuntimeState;
  gitViewElement: HTMLElement | null;
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  renderGitFileTreeNodes: (commitHash: string, nodes: GitFileTreeNode[]) => string;
  renderRefreshIcon: () => string;
} & GitRuntimeSelectionHelpers;

export function getActiveGitProject(
  currentState: AppStateSnapshot | null,
  helpers: GitRuntimeSelectionHelpers,
): SidebarProject | null {
  return currentState ? helpers.getActiveSidebarProject(currentState) : null;
}

export function shouldRenderGitTab(
  currentState: AppStateSnapshot | null,
  state: GitRuntimeState,
  helpers: GitRuntimeSelectionHelpers,
): boolean {
  const activeProject = getActiveGitProject(currentState, helpers);
  if (!activeProject?.folderPath) {
    return false;
  }

  if (state.gitPanelProjectId !== activeProject.projectId) {
    return state.gitPanelIsLoading;
  }

  return state.gitPanelIsLoading || Boolean(state.gitPanelOverview) || Boolean(state.gitPanelLoadError);
}

export async function refreshGitCommitDetails(options: RefreshGitCommitDetailsOptions): Promise<void> {
  const currentState = options.getState();
  const requestId = currentState.gitCommitDetailsLoadingRequest + 1;
  const nextState: GitRuntimeState = {
    ...currentState,
    gitCommitDetailsLoadingRequest: requestId,
    gitCommitDetailsIsLoading: Boolean(options.commitHash),
    gitCommitDetailsError: null,
    gitCommitDetails: !options.commitHash || currentState.gitCommitDetails?.commitHash !== options.commitHash
      ? null
      : currentState.gitCommitDetails,
  };

  if (!options.commitHash) {
    options.setState({
      ...nextState,
      gitCommitDetails: null,
      gitCommitDetailsIsLoading: false,
    });
    options.renderBottomPanel();
    return;
  }

  options.setState(nextState);
  options.renderBottomPanel();

  try {
    const result = await options.getGitCommitDetails(options.projectId, options.commitHash);
    const latestState = options.getState();
    if (
      requestId !== latestState.gitCommitDetailsLoadingRequest
      || latestState.gitPanelProjectId !== options.projectId
      || latestState.selectedGitCommitHash !== options.commitHash
    ) {
      return;
    }

    options.setState({
      ...latestState,
      gitCommitDetailsIsLoading: false,
      gitCommitDetails: result.kind === 'ready' ? result.details : null,
      gitCommitDetailsError: result.kind === 'error' ? result.errorMessage : null,
    });
    options.renderBottomPanel();
  } catch (error) {
    const latestState = options.getState();
    if (
      requestId !== latestState.gitCommitDetailsLoadingRequest
      || latestState.gitPanelProjectId !== options.projectId
      || latestState.selectedGitCommitHash !== options.commitHash
    ) {
      return;
    }

    options.setState({
      ...latestState,
      gitCommitDetailsIsLoading: false,
      gitCommitDetails: null,
      gitCommitDetailsError: error instanceof Error ? error.message : String(error),
    });
    options.renderBottomPanel();
  }
}

export async function refreshGitPanel(options: RefreshGitPanelOptions): Promise<void> {
  const currentState = options.getState();
  const requestId = currentState.gitPanelLoadingRequest + 1;
  options.setState({
    ...currentState,
    gitPanelLoadingRequest: requestId,
    gitPanelIsLoading: true,
    gitPanelLoadError: null,
  });
  options.renderBottomPanel();

  try {
    const result = await options.getGitOverview(options.projectId, options.refName);
    const latestState = options.getState();
    if (requestId !== latestState.gitPanelLoadingRequest || latestState.gitPanelProjectId !== options.projectId) {
      return;
    }

    if (result.kind === 'ready') {
      const focusedBranchHeadHash = result.overview.branches.find((branch) => branch.name === result.overview.selectedRefName)?.commitHash ?? null;
      const nextCommitHash = latestState.selectedGitCommitHash && result.overview.commits.some((commit) => commit.hash === latestState.selectedGitCommitHash)
        ? latestState.selectedGitCommitHash
        : focusedBranchHeadHash && result.overview.commits.some((commit) => commit.hash === focusedBranchHeadHash)
          ? focusedBranchHeadHash
          : result.overview.commits[0]?.hash ?? null;

      options.setState({
        ...latestState,
        gitPanelIsLoading: false,
        gitPanelOverview: result.overview,
        gitPanelLoadError: null,
        gitPanelSelectedRefName: result.overview.selectedRefName,
        selectedGitBranchName: result.overview.selectedRefName,
        selectedGitCommitHash: nextCommitHash,
        gitCommitDetails: nextCommitHash ? latestState.gitCommitDetails : null,
        gitCommitDetailsError: nextCommitHash ? latestState.gitCommitDetailsError : null,
        gitCommitDetailsIsLoading: nextCommitHash ? latestState.gitCommitDetailsIsLoading : false,
      });

      if (nextCommitHash) {
        await options.refreshGitCommitDetails(options.projectId, nextCommitHash);
      }
      options.renderBottomPanel();
      return;
    }

    if (result.kind === 'error') {
      options.setState({
        ...latestState,
        gitPanelIsLoading: false,
        gitPanelOverview: null,
        gitPanelLoadError: result.errorMessage,
        gitPanelSelectedRefName: options.refName ?? null,
        selectedGitCommitHash: null,
        gitCommitDetails: null,
        gitCommitDetailsError: null,
        gitCommitDetailsIsLoading: false,
      });
      options.renderBottomPanel();
      return;
    }

    options.setState({
      ...latestState,
      gitPanelIsLoading: false,
      gitPanelOverview: null,
      gitPanelLoadError: null,
      gitPanelSelectedRefName: null,
      selectedGitBranchName: null,
      selectedGitCommitHash: null,
      gitCommitDetails: null,
      gitCommitDetailsError: null,
      gitCommitDetailsIsLoading: false,
      activeBottomTabId: latestState.activeBottomTabId === 'git' ? 'debug' : latestState.activeBottomTabId,
    });
    options.renderBottomPanel();
  } catch (error) {
    const latestState = options.getState();
    if (requestId !== latestState.gitPanelLoadingRequest || latestState.gitPanelProjectId !== options.projectId) {
      return;
    }

    options.setState({
      ...latestState,
      gitPanelIsLoading: false,
      gitPanelOverview: null,
      gitPanelLoadError: error instanceof Error ? error.message : String(error),
      gitCommitDetails: null,
      gitCommitDetailsError: null,
      gitCommitDetailsIsLoading: false,
    });
    options.renderBottomPanel();
  }
}

export function syncGitPanelWithCurrentProject(options: SyncGitPanelWithCurrentProjectOptions): void {
  const activeProject = getActiveGitProject(options.currentState, options);
  const nextProjectId = activeProject?.folderPath ? activeProject.projectId : null;
  const currentRuntimeState = options.getState();
  if (currentRuntimeState.gitPanelProjectId === nextProjectId) {
    return;
  }

  options.setState({
    ...currentRuntimeState,
    gitPanelProjectId: nextProjectId,
    gitPanelSelectedRefName: null,
    gitPanelOverview: null,
    gitPanelLoadError: null,
    gitPanelIsLoading: Boolean(nextProjectId),
    selectedGitBranchName: null,
    selectedGitCommitHash: null,
    gitCommitDetails: null,
    gitCommitDetailsError: null,
    gitCommitDetailsIsLoading: false,
    activeBottomTabId: !nextProjectId && currentRuntimeState.activeBottomTabId === 'git' ? 'debug' : currentRuntimeState.activeBottomTabId,
  });

  if (nextProjectId) {
    void options.refreshGitPanel(nextProjectId, null);
  }
}

export function renderGitPanel(options: RenderGitPanelOptions): void {
  if (!options.gitViewElement) {
    return;
  }

  const captureScrollTop = (role: 'branches' | 'commits' | 'files'): number => {
    const element = options.gitViewElement?.querySelector(`[data-git-scroll="${role}"]`) as HTMLElement | null;
    return element?.scrollTop ?? 0;
  };

  const restoreScrollTop = (role: 'branches' | 'commits' | 'files', scrollTop: number): void => {
    const element = options.gitViewElement?.querySelector(`[data-git-scroll="${role}"]`) as HTMLElement | null;
    if (!element) {
      return;
    }

    element.scrollTop = scrollTop;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        element.scrollTop = scrollTop;
      });
    }
  };

  const previousBranchesScrollTop = captureScrollTop('branches');
  const previousCommitsScrollTop = captureScrollTop('commits');
  const previousFilesScrollTop = captureScrollTop('files');

  const activeProject = getActiveGitProject(options.currentState, options);
  const hasProject = Boolean(activeProject?.folderPath && options.state.gitPanelProjectId === activeProject.projectId);
  options.gitViewElement.innerHTML = renderGitPanelMarkup(
    {
      activeProjectName: activeProject?.projectName ?? 'Project',
      hasProject,
      isLoading: options.state.gitPanelIsLoading,
      loadError: options.state.gitPanelLoadError,
      overview: options.state.gitPanelOverview,
      selectedBranchName: options.state.selectedGitBranchName,
      selectedCommitHash: options.state.selectedGitCommitHash,
      commitDetails: options.state.gitCommitDetails,
      commitDetailsIsLoading: options.state.gitCommitDetailsIsLoading,
      commitDetailsError: options.state.gitCommitDetailsError,
    },
    {
      escapeHtml: options.escapeHtml,
      formatTimestamp: options.formatTimestamp,
      renderGitFileTreeNodes: options.renderGitFileTreeNodes,
      renderRefreshIcon: options.renderRefreshIcon,
    },
  );

  restoreScrollTop('branches', previousBranchesScrollTop);
  restoreScrollTop('commits', previousCommitsScrollTop);
  restoreScrollTop('files', previousFilesScrollTop);
}
