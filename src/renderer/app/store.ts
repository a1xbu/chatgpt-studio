import type { AppStateSnapshot, ChatFileArchiveEntryRecord, DebugLogEntry, PromptRecord } from '../../shared/contracts';
import type { BottomPanelRuntimeState } from '../bottom-panel/runtime';
import type { BottomPanelTerminalUiState } from '../bottom-panel/runtime-view';
import type { BrowserNavigationState } from '../browser/navigation';
import type { LocalProjectFileEntry, TerminalSessionState } from '../desktop-api';
import type { DebugRuntimeState } from '../debug/runtime';
import type { EditorRuntimeState } from '../editor/runtime';
import type { EditorTabState } from '../editor/types';
import type { GitRuntimeState } from '../git/runtime';
import type { GitCommitDetails, GitRepositoryOverview } from '../git/types';
import type { PromptMenuRuntimeState } from '../prompts/view-runtime';
import type { FileDownloadRuntimeStatus, XtermFitAddon, XtermTerminal } from '../runtime-types';
import {
  loadExpandedProjectIds,
  loadInitialNewFilesCollapsed,
  loadInitialSidebarDetailsCollapsed,
  loadInitialSidebarSelection,
  loadInitialSidebarTab,
  loadLastBrowserOpenedSelection,
} from '../sidebar/storage';
import type {
  ArchiveApplyWarningDialogState,
  PromptMenuState,
  PromptNameDialogState,
  PropertiesDialogState,
  SidebarSelection,
  SidebarTabId,
  TreeMenuState,
} from '../sidebar/types';
import { rendererShellConfig } from './shell-config';

export type RendererStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type RendererAppStoreSlice = {
  currentState: AppStateSnapshot | null;
};

export type RendererWorkspaceStoreSlice = {
  expandedProjectIds: Set<string>;
  isSidebarDetailsCollapsed: boolean;
  activeSidebarTabId: SidebarTabId;
  isNewFilesCollapsed: boolean;
  selectedSidebarItem: SidebarSelection | null;
  lastAutoExpandedProjectId: string | null;
};

export type RendererFilesStoreSlice = {
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  localFileErrorsByKey: Map<string, string>;
  localFileLoadingKeys: Set<string>;
  expandedLocalDirectoryKeys: Set<string>;
  projectBundleCreateInFlightIds: Set<string>;
  projectBundleErrorsByProjectId: Map<string, string>;
  projectFileSignatures: Map<string, string>;
};

export type RendererRemoteFilesStoreSlice = {
  downloadAutomatically: boolean;
  archiveEntriesByFileKey: Map<string, ChatFileArchiveEntryRecord[]>;
  archiveEntryErrorsByFileKey: Map<string, string>;
  archiveEntryLoadingKeys: Set<string>;
  expandedNewFilesKeys: Set<string>;
  lastNewFilesSignature: string;
  remoteFilesNotice: { message: string; tone: 'info' | 'success' | 'error' } | null;
  remoteFilesNoticeTimer: number | null;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
};

export type RendererBrowserStoreSlice = BrowserNavigationState & {
  browserOpenedSidebarItem: SidebarSelection | null;
  hasRestoredLastOpenState: boolean;
};

export type RendererMenuStoreSlice = {
  activeTreeMenu: TreeMenuState | null;
  activePromptMenu: PromptMenuState | null;
  activeTreeMenuCloseTimer: number | null;
  activePromptMenuCloseTimer: number | null;
};

export type RendererDialogStoreSlice = {
  propertiesDialogState: PropertiesDialogState;
  archiveApplyWarningDialogState: ArchiveApplyWarningDialogState | null;
  promptNameDialogState: PromptNameDialogState | null;
};

export type RendererEditorStoreSlice = {
  editorTabs: EditorTabState[];
  promptDirectoryPath: string;
  prompts: PromptRecord[];
  promptContentCache: Map<string, string>;
  lastRenderedPromptEditorStateKey: string;
  activeEditorTabId: EditorTabState['id'];
  activePairedEditorSubtab: 'browser' | 'local';
};

export type RendererBottomPanelStoreSlice = {
  debugLogs: DebugLogEntry[];
  terminalSessions: TerminalSessionState[];
  isDebugPanelCollapsed: boolean;
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
  collapsedGitCommitDirectoryKeys: Set<string>;
  terminalInstance: XtermTerminal | null;
  terminalFitAddon: XtermFitAddon | null;
  terminalFitScheduled: boolean;
  renderedTerminalSessionId: string | null;
  renderedTerminalOutputLength: number;
  nextTerminalOrdinal: number;
  debugFilterText: string;
  debugRetentionLimit: number;
};

export type RendererStore = {
  app: RendererAppStoreSlice;
  workspace: RendererWorkspaceStoreSlice;
  files: RendererFilesStoreSlice;
  remoteFiles: RendererRemoteFilesStoreSlice;
  browser: RendererBrowserStoreSlice;
  menus: RendererMenuStoreSlice;
  dialogs: RendererDialogStoreSlice;
  editor: RendererEditorStoreSlice;
  bottomPanel: RendererBottomPanelStoreSlice;
  getBrowserNavigationState: () => BrowserNavigationState;
  setBrowserNavigationState: (nextState: BrowserNavigationState) => void;
  getEditorRuntimeState: () => EditorRuntimeState;
  setEditorRuntimeState: (nextState: EditorRuntimeState) => void;
  getPromptMenuRuntimeState: () => PromptMenuRuntimeState;
  setPromptMenuRuntimeState: (nextState: PromptMenuRuntimeState) => void;
  getBottomPanelRuntimeState: () => BottomPanelRuntimeState;
  setBottomPanelRuntimeState: (nextState: BottomPanelRuntimeState) => void;
  getDebugRuntimeState: () => DebugRuntimeState;
  getGitRuntimeState: () => GitRuntimeState;
  setGitRuntimeState: (nextState: GitRuntimeState) => void;
  getTerminalUiState: () => BottomPanelTerminalUiState;
  setTerminalUiState: (nextState: BottomPanelTerminalUiState) => void;
};

export type CreateRendererStoreOptions = {
  storage: RendererStorageLike;
  initialEditorTabs?: EditorTabState[];
  initialActiveEditorTabId?: EditorTabState['id'];
  initialActivePairedEditorSubtab?: 'browser' | 'local';
  initialDebugRetentionLimit?: number;
};

const DEFAULT_EDITOR_TABS: EditorTabState[] = [{ id: 'browser', kind: 'browser', title: 'Browser' }];
const DEFAULT_DEBUG_RETENTION_LIMIT = 100;

export function createRendererStore(options: CreateRendererStoreOptions): RendererStore {
  const { storage } = options;
  const storageKeys = rendererShellConfig.storage;

  const app: RendererAppStoreSlice = {
    currentState: null,
  };

  const workspace: RendererWorkspaceStoreSlice = {
    expandedProjectIds: loadExpandedProjectIds(storage as Storage, storageKeys.projectTreeExpandedKey),
    isSidebarDetailsCollapsed: loadInitialSidebarDetailsCollapsed(storage as Storage, storageKeys.sidebarDetailsCollapsedKey),
    activeSidebarTabId: loadInitialSidebarTab(storage as Storage, storageKeys.sidebarActiveTabKey) as SidebarTabId,
    isNewFilesCollapsed: loadInitialNewFilesCollapsed(storage as Storage, storageKeys.newFilesCollapsedKey),
    selectedSidebarItem: loadInitialSidebarSelection(storage as Storage, storageKeys.sidebarSelectionKey) as SidebarSelection | null,
    lastAutoExpandedProjectId: null,
  };

  const files: RendererFilesStoreSlice = {
    localFileEntriesByKey: new Map<string, LocalProjectFileEntry[]>(),
    localFileErrorsByKey: new Map<string, string>(),
    localFileLoadingKeys: new Set<string>(),
    expandedLocalDirectoryKeys: new Set<string>(),
    projectBundleCreateInFlightIds: new Set<string>(),
    projectBundleErrorsByProjectId: new Map<string, string>(),
    projectFileSignatures: new Map<string, string>(),
  };

  const remoteFiles: RendererRemoteFilesStoreSlice = {
    downloadAutomatically: storage.getItem(storageKeys.downloadAutomaticallyKey) === 'true',
    archiveEntriesByFileKey: new Map<string, ChatFileArchiveEntryRecord[]>(),
    archiveEntryErrorsByFileKey: new Map<string, string>(),
    archiveEntryLoadingKeys: new Set<string>(),
    expandedNewFilesKeys: new Set<string>(),
    lastNewFilesSignature: '',
    remoteFilesNotice: null,
    remoteFilesNoticeTimer: null,
    fileDownloadStatuses: new Map<string, FileDownloadRuntimeStatus>(),
  };

  const browser: RendererBrowserStoreSlice = {
    browserCanGoBack: false,
    browserCanGoForward: false,
    browserIsLoading: false,
    pendingBrowserUrl: null,
    browserOpenedSidebarItem: loadLastBrowserOpenedSelection(storage as Storage, storageKeys.lastBrowserOpenedKey) as SidebarSelection | null,
    hasRestoredLastOpenState: false,
  };

  const menus: RendererMenuStoreSlice = {
    activeTreeMenu: null,
    activePromptMenu: null,
    activeTreeMenuCloseTimer: null,
    activePromptMenuCloseTimer: null,
  };

  const dialogs: RendererDialogStoreSlice = {
    propertiesDialogState: null,
    archiveApplyWarningDialogState: null,
    promptNameDialogState: null,
  };

  const editor: RendererEditorStoreSlice = {
    editorTabs: [...(options.initialEditorTabs ?? DEFAULT_EDITOR_TABS)],
    promptDirectoryPath: '',
    prompts: [],
    promptContentCache: new Map<string, string>(),
    lastRenderedPromptEditorStateKey: '',
    activeEditorTabId: options.initialActiveEditorTabId ?? 'browser',
    activePairedEditorSubtab: options.initialActivePairedEditorSubtab ?? 'browser',
  };

  const bottomPanel: RendererBottomPanelStoreSlice = {
    debugLogs: [],
    terminalSessions: [],
    isDebugPanelCollapsed: false,
    activeBottomTabId: 'debug',
    gitPanelProjectId: null,
    gitPanelSelectedRefName: null,
    gitPanelOverview: null,
    gitPanelLoadError: null,
    gitPanelLoadingRequest: 0,
    gitPanelIsLoading: false,
    selectedGitBranchName: null,
    selectedGitCommitHash: null,
    gitCommitDetails: null,
    gitCommitDetailsError: null,
    gitCommitDetailsIsLoading: false,
    gitCommitDetailsLoadingRequest: 0,
    collapsedGitCommitDirectoryKeys: new Set<string>(),
    terminalInstance: null,
    terminalFitAddon: null,
    terminalFitScheduled: false,
    renderedTerminalSessionId: null,
    renderedTerminalOutputLength: 0,
    nextTerminalOrdinal: 1,
    debugFilterText: '',
    debugRetentionLimit: options.initialDebugRetentionLimit ?? DEFAULT_DEBUG_RETENTION_LIMIT,
  };

  const store: RendererStore = {
    app,
    workspace,
    files,
    remoteFiles,
    browser,
    menus,
    dialogs,
    editor,
    bottomPanel,
    getBrowserNavigationState: () => ({
      browserCanGoBack: browser.browserCanGoBack,
      browserCanGoForward: browser.browserCanGoForward,
      browserIsLoading: browser.browserIsLoading,
      pendingBrowserUrl: browser.pendingBrowserUrl,
    }),
    setBrowserNavigationState: (nextState) => {
      browser.browserCanGoBack = nextState.browserCanGoBack;
      browser.browserCanGoForward = nextState.browserCanGoForward;
      browser.browserIsLoading = nextState.browserIsLoading;
      browser.pendingBrowserUrl = nextState.pendingBrowserUrl;
    },
    getEditorRuntimeState: () => ({
      editorTabs: editor.editorTabs,
      activeEditorTabId: editor.activeEditorTabId,
      activePairedEditorSubtab: editor.activePairedEditorSubtab,
    }),
    setEditorRuntimeState: (nextState) => {
      editor.editorTabs = nextState.editorTabs;
      editor.activeEditorTabId = nextState.activeEditorTabId;
      editor.activePairedEditorSubtab = nextState.activePairedEditorSubtab;
    },
    getPromptMenuRuntimeState: () => ({
      activePromptMenu: menus.activePromptMenu,
      activePromptMenuCloseTimer: menus.activePromptMenuCloseTimer,
    }),
    setPromptMenuRuntimeState: (nextState) => {
      menus.activePromptMenu = nextState.activePromptMenu;
      menus.activePromptMenuCloseTimer = nextState.activePromptMenuCloseTimer;
    },
    getBottomPanelRuntimeState: () => ({
      activeBottomTabId: bottomPanel.activeBottomTabId,
      terminalSessions: bottomPanel.terminalSessions,
      renderedTerminalSessionId: bottomPanel.renderedTerminalSessionId,
      renderedTerminalOutputLength: bottomPanel.renderedTerminalOutputLength,
      nextTerminalOrdinal: bottomPanel.nextTerminalOrdinal,
      isDebugPanelCollapsed: bottomPanel.isDebugPanelCollapsed,
    }),
    setBottomPanelRuntimeState: (nextState) => {
      bottomPanel.activeBottomTabId = nextState.activeBottomTabId;
      bottomPanel.terminalSessions = nextState.terminalSessions;
      bottomPanel.renderedTerminalSessionId = nextState.renderedTerminalSessionId;
      bottomPanel.renderedTerminalOutputLength = nextState.renderedTerminalOutputLength;
      bottomPanel.nextTerminalOrdinal = nextState.nextTerminalOrdinal;
      bottomPanel.isDebugPanelCollapsed = nextState.isDebugPanelCollapsed;
    },
    getDebugRuntimeState: () => ({
      debugLogs: bottomPanel.debugLogs,
      debugFilterText: bottomPanel.debugFilterText,
      debugRetentionLimit: bottomPanel.debugRetentionLimit,
    }),
    getGitRuntimeState: () => ({
      activeBottomTabId: bottomPanel.activeBottomTabId,
      gitPanelProjectId: bottomPanel.gitPanelProjectId,
      gitPanelSelectedRefName: bottomPanel.gitPanelSelectedRefName,
      gitPanelOverview: bottomPanel.gitPanelOverview,
      gitPanelLoadError: bottomPanel.gitPanelLoadError,
      gitPanelLoadingRequest: bottomPanel.gitPanelLoadingRequest,
      gitPanelIsLoading: bottomPanel.gitPanelIsLoading,
      selectedGitBranchName: bottomPanel.selectedGitBranchName,
      selectedGitCommitHash: bottomPanel.selectedGitCommitHash,
      gitCommitDetails: bottomPanel.gitCommitDetails,
      gitCommitDetailsError: bottomPanel.gitCommitDetailsError,
      gitCommitDetailsIsLoading: bottomPanel.gitCommitDetailsIsLoading,
      gitCommitDetailsLoadingRequest: bottomPanel.gitCommitDetailsLoadingRequest,
    }),
    setGitRuntimeState: (nextState) => {
      bottomPanel.activeBottomTabId = nextState.activeBottomTabId;
      bottomPanel.gitPanelProjectId = nextState.gitPanelProjectId;
      bottomPanel.gitPanelSelectedRefName = nextState.gitPanelSelectedRefName;
      bottomPanel.gitPanelOverview = nextState.gitPanelOverview;
      bottomPanel.gitPanelLoadError = nextState.gitPanelLoadError;
      bottomPanel.gitPanelLoadingRequest = nextState.gitPanelLoadingRequest;
      bottomPanel.gitPanelIsLoading = nextState.gitPanelIsLoading;
      bottomPanel.selectedGitBranchName = nextState.selectedGitBranchName;
      bottomPanel.selectedGitCommitHash = nextState.selectedGitCommitHash;
      bottomPanel.gitCommitDetails = nextState.gitCommitDetails;
      bottomPanel.gitCommitDetailsError = nextState.gitCommitDetailsError;
      bottomPanel.gitCommitDetailsIsLoading = nextState.gitCommitDetailsIsLoading;
      bottomPanel.gitCommitDetailsLoadingRequest = nextState.gitCommitDetailsLoadingRequest;
    },
    getTerminalUiState: () => ({
      terminalInstance: bottomPanel.terminalInstance,
      terminalFitAddon: bottomPanel.terminalFitAddon,
    }),
    setTerminalUiState: (nextState) => {
      bottomPanel.terminalInstance = nextState.terminalInstance;
      bottomPanel.terminalFitAddon = nextState.terminalFitAddon;
    },
  };

  return store;
}
