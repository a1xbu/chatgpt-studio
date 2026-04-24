import type { AppStateSnapshot, PromptRecord } from '../../shared/contracts';
import type { BottomPanelFeature } from '../bottom-panel/feature';
import type { BrowserController } from '../browser/controller';
import type { BrowserFeature } from '../browser/feature';
import type { ChatHistoryUpdatePayload, LocalProjectFileEntry } from '../desktop-api';
import type { EditorFeature } from '../editor/feature';
import type { FilesFeature } from '../files/feature';
import type { PromptsFeature } from '../prompts/feature';
import type { RendererSidebarBindingsSlice, RendererSidebarBootstrapSlice } from '../sidebar/host';
import type { FileDownloadRuntimeStatus } from '../runtime-types';
import type { SidebarFeature } from '../sidebar/feature';
import type { RendererWorkbenchBindingsSlice, RendererWorkbenchBootstrapSlice } from '../workbench/host';
import type { RendererBindingsCompositionOptions, RendererBootstrapCompositionOptions } from './composition';

export type RendererFeatureComposition = {
  sidebar: SidebarFeature;
  files: FilesFeature;
  prompts: PromptsFeature;
  editor: EditorFeature;
  browser: BrowserFeature;
  bottomPanel: BottomPanelFeature;
};

export function createRendererFeatureComposition(features: RendererFeatureComposition): RendererFeatureComposition {
  return features;
}

export type RendererBottomPanelBootstrapSlice = {
  uiState: Pick<RendererBootstrapCompositionOptions['uiState'],
    'applyDebugPanelHeight' |
    'applyDebugPanelState' |
    'installBottomPanelResizer'
  >;
  state: Pick<RendererBootstrapCompositionOptions['state'],
    'setDebugLogs' |
    'setTerminalSessions' |
    'setDebugRetentionLimit' |
    'setIsDebugPanelCollapsed'
  >;
  actions: Pick<RendererBootstrapCompositionOptions['actions'],
    'createTerminalSessionState' |
    'addDebugLog' |
    'pushDebugLogEntry' |
    'handleTerminalData' |
    'handleTerminalExit' |
    'scheduleTerminalFit'
  >;
};

type DerivedRendererBootstrapStateKeys =
  | 'persistBrowserOpenedSelection'
  | 'setDebugLogs'
  | 'setTerminalSessions'
  | 'setDebugRetentionLimit'
  | 'setIsDebugPanelCollapsed';

export type RendererBootstrapAssemblyContext = {
  features: RendererFeatureComposition;
  elements: RendererBootstrapCompositionOptions['elements'];
  localStorage: Storage;
  storageKeys: RendererBootstrapCompositionOptions['storageKeys'];
  limits: RendererBootstrapCompositionOptions['limits'];
  sidebar: RendererSidebarBootstrapSlice;
  bottomPanel: RendererBottomPanelBootstrapSlice;
  desktopPoc: RendererBootstrapCompositionOptions['desktopPoc'];
  state: Omit<RendererBootstrapCompositionOptions['state'], DerivedRendererBootstrapStateKeys>;
  shell: {
    render: () => void;
  };
  browserController: Pick<BrowserController, 'updateUrl' | 'syncControls' | 'refreshNavigationState'>;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  workbench: RendererWorkbenchBootstrapSlice;
};

export function createRendererBootstrapAssemblyContext(
  context: RendererBootstrapAssemblyContext,
): RendererBootstrapAssemblyContext {
  return context;
}

type DerivedRendererBindingsStateKeys =
  | 'getActiveSidebarTabId'
  | 'setActiveSidebarTabId'
  | 'persistBrowserOpenedSelection'
  | 'getActiveTreeMenu'
  | 'setActiveTreeMenu'
  | 'setSelectedSidebarItem'
  | 'isActiveTreeMenuOpen'
  | 'closeActiveTreeMenu'
  | 'setBrowserOpenedSidebarItem'
  | 'setDownloadAutomatically'
  | 'toggleBottomPanel'
  | 'getGitPanelProjectId'
  | 'getSelectedGitRefName'
  | 'setSelectedGitBranchName'
  | 'getSelectedGitCommitHash'
  | 'setSelectedGitCommitHash'
  | 'clearGitCommitDetailsState'
  | 'setGitPanelLoadError'
  | 'setDebugFilterText'
  | 'setDebugRetentionLimit'
  | 'setPropertiesDialogProject'
  | 'setPropertiesDialogChat'
  | 'isPromptNameDialogOpen'
  | 'isArchiveApplyWarningOpen'
  | 'closePropertiesDialog'
  | 'isPropertiesDialogOpen'
  | 'isActivePromptMenuOpen'
  | 'closeActivePromptMenu'
  | 'getPromptById';

type DerivedRendererBindingsActionKeys =
  | 'persistActiveSidebarTabId'
  | 'getLocalFileTreeKey'
  | 'clearActiveTreeMenuCloseTimer'
  | 'scheduleActiveTreeMenuClose'
  | 'persistExpandedProjectIds'
  | 'ensureFilesViewLoaded'
  | 'refreshLocalProjectTree'
  | 'renderFileViewPanel'
  | 'loadLocalFileTree'
  | 'openCreatePromptDialog'
  | 'setActivePromptMenu'
  | 'openPromptTab'
  | 'findPromptEditorTab'
  | 'enterPromptEditMode'
  | 'savePromptTab'
  | 'cancelPromptEditing'
  | 'closeEditorTab'
  | 'activatePairedEditorView'
  | 'activateEditorTab'
  | 'showRemoteFilesNotice'
  | 'findLatestNewFileByKey'
  | 'getLatestEntries'
  | 'findLatestEntryByKey'
  | 'runApplySandboxFile'
  | 'toggleNewFilesCollapsed'
  | 'runApplyAllNewFiles'
  | 'getRemoteFileRootKey'
  | 'getRemoteFileArchiveBranchKey'
  | 'loadArchiveEntriesForFile'
  | 'shouldWarnBeforeApplyingArchive'
  | 'persistDownloadAutomatically'
  | 'getEffectiveDownloadPath'
  | 'newIsoTimestamp'
  | 'copyVisibleDebugLogs'
  | 'clearDebugLogs'
  | 'openEmbeddedTerminal'
  | 'closeTerminalSession'
  | 'switchBottomTab'
  | 'renderDebugLogs'
  | 'refreshGitPanel'
  | 'renderBottomPanel'
  | 'renderGitPanel'
  | 'refreshGitCommitDetails'
  | 'getGitCommitDirectoryKey'
  | 'persistBrowserOpenedSelection'
  | 'openChatHistoryTab'
  | 'getChatEditorTabId'
  | 'hasEditorTab'
  | 'isBrowserPairedWithChat'
  | 'openBrowserForPairedChat'
  | 'openLocalChatInChatGpt'
  | 'sendBrowserFileCommand'
  | 'queueAutomaticSandboxDownloads'
  | 'submitPromptNameDialog'
  | 'closePromptNameDialog'
  | 'closeArchiveApplyWarningDialog'
  | 'addDebugLog'
  | 'openRenamePromptDialog'
  | 'deletePrompt'
  | 'openArchiveApplyWarningDialog'
  | 'resolveProjectBrowserUrl'
  | 'resolveChatBrowserUrl';

export type RendererBrowserBindingsSlice = {
  state: Pick<RendererBindingsCompositionOptions['state'],
    'setBrowserOpenedSidebarItem' |
    'persistBrowserOpenedSelection'
  >;
  actions: Pick<RendererBindingsCompositionOptions['actions'],
    'persistBrowserOpenedSelection' |
    'sendBrowserFileCommand' |
    'queueAutomaticSandboxDownloads' |
    'resolveProjectBrowserUrl' |
    'resolveChatBrowserUrl'
  >;
};

export type RendererRemoteFilesBindingsSlice = {
  state: Pick<RendererBindingsCompositionOptions['state'], 'setDownloadAutomatically'>;
  actions: Pick<RendererBindingsCompositionOptions['actions'],
    'showRemoteFilesNotice' |
    'findLatestNewFileByKey' |
    'getLatestEntries' |
    'findLatestEntryByKey' |
    'runApplySandboxFile' |
    'toggleNewFilesCollapsed' |
    'runApplyAllNewFiles' |
    'getRemoteFileRootKey' |
    'getRemoteFileArchiveBranchKey' |
    'loadArchiveEntriesForFile' |
    'shouldWarnBeforeApplyingArchive' |
    'persistDownloadAutomatically' |
    'getEffectiveDownloadPath' |
    'newIsoTimestamp'
  >;
};

export type RendererBottomPanelBindingsSlice = {
  state: Pick<RendererBindingsCompositionOptions['state'],
    'toggleBottomPanel' |
    'getGitPanelProjectId' |
    'getSelectedGitRefName' |
    'setSelectedGitBranchName' |
    'getSelectedGitCommitHash' |
    'setSelectedGitCommitHash' |
    'clearGitCommitDetailsState' |
    'setGitPanelLoadError' |
    'setDebugFilterText' |
    'setDebugRetentionLimit'
  >;
  actions: Pick<RendererBindingsCompositionOptions['actions'],
    'copyVisibleDebugLogs' |
    'clearDebugLogs' |
    'openEmbeddedTerminal' |
    'closeTerminalSession' |
    'switchBottomTab' |
    'renderDebugLogs' |
    'refreshGitPanel' |
    'renderBottomPanel' |
    'renderGitPanel' |
    'refreshGitCommitDetails' |
    'getGitCommitDirectoryKey' |
    'addDebugLog'
  >;
};

export type RendererBindingsAssemblyContext = {
  features: RendererFeatureComposition;
  elements: RendererBindingsCompositionOptions['elements'];
  localStorage: Storage;
  desktopPoc: RendererBindingsCompositionOptions['desktopPoc'];
  browserController: RendererBindingsCompositionOptions['browserController'];
  promptContentCache: Map<string, string>;
  prompts: PromptRecord[];
  expandedProjectIds: Set<string>;
  expandedLocalDirectoryKeys: Set<string>;
  projectBundleCreateInFlightIds: Set<string>;
  projectBundleErrorsByProjectId: Map<string, string>;
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  collapsedGitCommitDirectoryKeys: Set<string>;
  archiveEntriesByFileKey: Map<string, unknown[]>;
  expandedNewFilesKeys: Set<string>;
  fileDownloadStatuses: Map<string, FileDownloadRuntimeStatus>;
  constants: RendererBindingsCompositionOptions['constants'];
  state: Omit<RendererBindingsCompositionOptions['state'], DerivedRendererBindingsStateKeys>;
  actions: Omit<RendererBindingsCompositionOptions['actions'], DerivedRendererBindingsActionKeys> & {
    render: () => void;
    renderFileViewPanelStateCast?: (state: unknown) => AppStateSnapshot;
  };
  sidebar: RendererSidebarBindingsSlice;
  browser: RendererBrowserBindingsSlice;
  remoteFiles: RendererRemoteFilesBindingsSlice;
  bottomPanel: RendererBottomPanelBindingsSlice;
  alert: RendererBindingsCompositionOptions['alert'];
  confirm: RendererBindingsCompositionOptions['confirm'];
  workbench: RendererWorkbenchBindingsSlice;
};

export function createRendererBindingsAssemblyContext(
  context: RendererBindingsAssemblyContext,
): RendererBindingsAssemblyContext {
  return context;
}
