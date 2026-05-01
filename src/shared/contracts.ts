export const REMOTE_META_DIRECTORY = '.chatgpt-remote';
export const REMOTE_MANIFEST_FILE = `${REMOTE_META_DIRECTORY}/manifest.json`;

export interface RemoteManifest {
  project_id: string;
  summary?: string;
  project_root_in_archive?: string;
}


export interface GitStatusSummary {
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
}

export interface GitBranchRecord {
  name: string;
  isCurrent: boolean;
  upstream: string | null;
  aheadBy: number;
  behindBy: number;
  shortHash: string | null;
  commitHash: string | null;
}

export interface GitCommitRecord {
  hash: string;
  shortHash: string;
  authorName: string;
  authoredAt: string;
  subject: string;
  refs: string[];
  parentHashes: string[];
}

export interface GitCommitFileRecord {
  path: string;
  status: string;
  oldPath?: string | null;
}

export interface GitRepositoryOverview {
  repoRootPath: string;
  currentBranch: GitBranchRecord | null;
  selectedRefName: string;
  statusSummary: GitStatusSummary;
  branches: GitBranchRecord[];
  commits: GitCommitRecord[];
}

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

export interface GitCommitDetails {
  commitHash: string;
  files: GitCommitFileRecord[];
}

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

export interface PromptRecord {
  id: string;
  title: string;
  fileName: string;
  fullPath: string;
  updatedAt: string;
  createdAt: string;
  sizeBytes: number;
}

export interface PromptDirectorySnapshot {
  directoryPath: string;
  prompts: PromptRecord[];
}

export interface ChatPageContext {
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentChatId: string | null;
  currentChatName: string | null;
  detectedAt: string;
  pageUrl: string | null;
  projectUrl: string | null;
  chatUrl: string | null;
}

export type DebugLogLevel = 'info' | 'warn' | 'error';

export interface DebugLogEntry {
  id: string;
  level: DebugLogLevel;
  message: string;
  details: string | null;
  source: 'injected-script' | 'guest-preload' | 'webview';
  timestamp: string;
}

export interface ProjectBinding {
  projectId: string;
  projectName: string;
  folderPath: string;
  projectUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectChatRecord {
  chatId: string;
  chatName: string;
  projectId: string;
  projectName: string | null;
  chatUrl: string | null;
  updatedAt: string;
}

export type ChatHistoryMessageRole = 'assistant' | 'system' | 'tool' | 'user' | 'unknown';

export interface ChatHistoryReasoningStep {
  summary: string | null;
  content: string;
  chunks: string[];
}

export type ChatHistoryMultimodalPartKind = 'text' | 'image' | 'attachment' | 'unknown';

export interface ChatHistoryMultimodalPart {
  kind: ChatHistoryMultimodalPartKind;
  text: string | null;
  assetPointer?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface ChatHistoryReasoningSummary {
  recap: string;
  finishedDurationSec?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  steps: ChatHistoryReasoningStep[];
  stepsLoaded?: boolean;
}

export interface ChatHistoryMessageRecord {
  messageId: string | null;
  nodeId?: string | null;
  parentMessageId?: string | null;
  turnId?: string | null;
  role: ChatHistoryMessageRole;
  authorName?: string | null;
  modelSlug?: string | null;
  text: string;
  createdAt: string | null;
  updatedAt: string | null;
  contentType?: string | null;
  messageType?: string | null;
  language?: string | null;
  parts?: ChatHistoryMultimodalPart[] | null;
  children?: string[] | null;
  isHidden?: boolean;
  endTurn?: boolean | null;
  status?: string | null;
  reasoning?: ChatHistoryReasoningSummary | null;
  metadataJson?: string | null;
  rawJson?: string | null;
}


export type ArchiveEntryComparisonStatus = 'unchanged' | 'new' | 'modified';

export type RemoteManifestStatus = 'missing' | 'matched' | 'mismatched' | 'invalid';

export type GitBundleBranchRelation = 'unknown' | 'related' | 'unrelated';

export interface GitBundleBranchRecord {
  branchName: string;
  localBranchName: string | null;
  commitHash: string;
  shortHash: string;
  subject: string;
  authorName: string | null;
  committedAt: string | null;
  relation: GitBundleBranchRelation;
}

export interface GitBundleInspection {
  status: 'unknown' | 'ready' | 'unrelated' | 'invalid' | 'error' | 'applied';
  branches: GitBundleBranchRecord[];
  latestBranch: GitBundleBranchRecord | null;
  message: string | null;
  inspectedAt: string;
}

export interface ChatFileArchiveEntryRecord {
  relativePath: string;
  kind: 'file' | 'directory';
  sizeBytes: number;
  crc32?: number | null;
  comparisonStatus?: ArchiveEntryComparisonStatus;
}

export interface ChatFileRecord {
  projectId: string;
  projectName: string | null;
  chatId: string;
  messageId: string;
  sandboxPath: string;
  downloadUrl: string | null;
  downloadPath: string | null;
  fileName: string | null;
  sizeBytes?: number | null;
  discoveredAt: string;
  updatedAt: string;
  isProject?: boolean;
  projectSummary?: string | null;
  projectRootInArchive?: string | null;
  appliedAt?: string | null;
  applyError?: string | null;
  archiveEntryCount?: number | null;
  hasRemoteManifest?: boolean;
  remoteManifestProjectId?: string | null;
  remoteManifestStatus?: RemoteManifestStatus | null;
  gitBundle?: GitBundleInspection | null;
}


export interface ApplySandboxFileResult {
  file: ChatFileRecord;
  updatedFileCount: number;
  message?: string | null;
}

export interface ProjectBundleFileRecord {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  sha256: string;
}

export interface ProjectBundleRecord {
  projectId: string;
  bundlePath: string;
  createdAt: string;
  sizeBytes: number | null;
  fileCount: number;
  files: ProjectBundleFileRecord[];
}

export interface ChatHistoryRecord {
  projectId: string;
  projectName: string | null;
  chatId: string;
  chatName: string | null;
  messageCount: number;
  messages: ChatHistoryMessageRecord[];
  files?: ChatFileRecord[];
  searchText: string;
  updatedAt: string | null;
  capturedAt: string;
  isPartial?: boolean;
}

export interface SidebarProject {
  projectId: string;
  projectName: string;
  folderPath: string | null;
  projectUrl: string | null;
  status: 'temporary' | 'persistent';
  chats: ProjectChatRecord[];
  files: ChatFileRecord[];
  bundle: ProjectBundleRecord | null;
  lastSeenAt: string;
}

export interface AppStateSnapshot {
  browserUrl: string;
  lastContext: ChatPageContext | null;
  temporaryProjects: SidebarProject[];
  persistentProjects: SidebarProject[];
}
