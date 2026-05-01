import type {
  AppStateSnapshot,
  ApplySandboxFileResult,
  ChatFileArchiveEntryRecord,
  ChatHistoryReasoningStep,
  ChatHistoryRecord,
  DebugLogEntry,
  ProjectBundleRecord,
  PromptRecord,
} from '../shared/contracts';
import type { GitCommitDetailsResult, GitOverviewResult } from './git/types';

export type PromptDirectorySnapshot = {
  directoryPath: string;
  prompts: PromptRecord[];
};

export type PromptFilePayload = {
  prompt: PromptRecord;
  content: string;
};

export type TerminalSessionSnapshot = {
  sessionId: string;
  cwd: string | null;
  shell: string;
};

export type TerminalSessionState = TerminalSessionSnapshot & {
  title: string;
  outputBuffer: string;
  exited: boolean;
};

export type BootstrapPayload = {
  state: AppStateSnapshot;
  debugLogs: DebugLogEntry[];
  terminalSnapshots: TerminalSessionSnapshot[];
  browser: {
    url: string;
    partition: string;
    preloadUrl: string;
  };
};

export type TerminalDataPayload = {
  sessionId: string;
  data: string;
};

export type TerminalExitPayload = {
  sessionId: string;
  exitCode: number;
  signal?: number;
};

export type SaveChatHistoryJsonResult = {
  saved: boolean;
  filePath: string | null;
  errorMessage?: string | null;
};

export type ChatHistoryUpdatePayload = {
  projectId: string;
  chatId: string;
  revisionKey: string;
  updatedAt: string | null;
  capturedAt: string;
  messageCount: number;
  isPartial: boolean;
};

export type LocalProjectFileEntry = {
  name: string;
  relativePath: string;
  fullPath: string;
  kind: 'file' | 'directory';
  hasChildren: boolean;
  modifiedAt: string | null;
  createdAt: string | null;
  containsRecentModifiedFiles: boolean;
  isGitIgnored: boolean;
};

export type ConnectProjectResult = {
  binding: {
    folderPath: string;
    projectId: string;
    projectName: string;
  };
  metaDbPath: string;
} | null;

export type DesktopPocApi = {
  getBootstrap: () => Promise<BootstrapPayload>;
  clearDebugLogs: () => Promise<void>;
  getChatHistory: (projectId: string, chatId: string) => Promise<ChatHistoryRecord | null>;
  getChatMessageThoughts: (projectId: string, chatId: string, messageId: string) => Promise<ChatHistoryReasoningStep[]>;
  saveChatHistoryJson: (defaultFileName: string, content: string) => Promise<SaveChatHistoryJsonResult>;
  connectProject: (projectId: string) => Promise<ConnectProjectResult>;
  removeProject: (projectId: string) => Promise<boolean>;
  removeChat: (projectId: string, chatId: string) => Promise<boolean>;
  listPrompts: () => Promise<PromptDirectorySnapshot>;
  createPrompt: (name: string) => Promise<PromptRecord>;
  renamePrompt: (promptId: string, name: string) => Promise<PromptRecord>;
  deletePrompt: (promptId: string) => Promise<boolean>;
  readPrompt: (promptId: string) => Promise<PromptFilePayload | null>;
  writePrompt: (promptId: string, content: string) => Promise<PromptRecord>;
  openPromptsFolder: () => Promise<string>;
  openFolder: (folderPath: string) => Promise<string>;
  showItemInFolder: (fullPath: string) => Promise<boolean>;
  listProjectFiles: (projectId: string, relativePath?: string | null) => Promise<LocalProjectFileEntry[]>;
  listSandboxFileArchiveEntries: (
    projectId: string,
    chatId: string,
    messageId: string,
    sandboxPath: string,
  ) => Promise<ChatFileArchiveEntryRecord[]>;
  applySandboxFile: (
    projectId: string,
    chatId: string,
    messageId: string,
    sandboxPath: string,
    relativePath?: string | null,
  ) => Promise<ApplySandboxFileResult>;
  createProjectBundle: (projectId: string) => Promise<ProjectBundleRecord>;
  getGitOverview: (projectId: string, refName?: string | null) => Promise<GitOverviewResult>;
  getGitCommitDetails: (projectId: string, commitHash: string) => Promise<GitCommitDetailsResult>;
  startFileDrag: (fullPath: string) => void;
  startTerminal: (cwd: string | null, cols: number, rows: number) => Promise<TerminalSessionSnapshot>;
  writeTerminal: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (sessionId?: string) => Promise<void>;
  onStateChanged: (listener: (state: AppStateSnapshot) => void) => () => void;
  onDebugEntry: (listener: (entry: DebugLogEntry) => void) => () => void;
  onChatHistoryUpdated: (listener: (payload: ChatHistoryUpdatePayload) => void) => () => void;
  onTerminalData: (listener: (payload: TerminalDataPayload) => void) => () => void;
  onTerminalExit: (listener: (payload: TerminalExitPayload) => void) => () => void;
};
