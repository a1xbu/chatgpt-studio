export type GitStatusSummary = {
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
};

export type GitBranchRecord = {
  name: string;
  isCurrent: boolean;
  upstream: string | null;
  aheadBy: number;
  behindBy: number;
  shortHash: string | null;
  commitHash: string | null;
};

export type GitCommitRecord = {
  hash: string;
  shortHash: string;
  authorName: string;
  authoredAt: string;
  subject: string;
  refs: string[];
  parentHashes: string[];
};

export type GitCommitFileRecord = {
  path: string;
  status: string;
  oldPath?: string | null;
};

export type GitCommitDetails = {
  commitHash: string;
  files: GitCommitFileRecord[];
};

export type GitRepositoryOverview = {
  repoRootPath: string;
  currentBranch: GitBranchRecord | null;
  selectedRefName: string;
  statusSummary: GitStatusSummary;
  branches: GitBranchRecord[];
  commits: GitCommitRecord[];
};

export type GitOverviewResult =
  | {
      kind: 'missing';
    }
  | {
      kind: 'ready';
      overview: GitRepositoryOverview;
    }
  | {
      kind: 'error';
      errorMessage: string;
    };

export type GitCommitDetailsResult =
  | {
      kind: 'missing';
    }
  | {
      kind: 'ready';
      details: GitCommitDetails;
    }
  | {
      kind: 'error';
      errorMessage: string;
    };
