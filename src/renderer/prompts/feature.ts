import type {
  AppStateSnapshot,
  ChatFileRecord,
  ProjectChatRecord,
  PromptDirectorySnapshot,
  PromptRecord,
  SidebarProject,
} from '../../shared/contracts';
import type { SharedFileTreeActionButtonModel, SharedFileTreeRowModel } from '../tree/shared-tree';
import {
  closePromptNameDialog as closePromptNameDialogImpl,
  openPromptNameDialog as openPromptNameDialogImpl,
  submitPromptNameDialog as submitPromptNameDialogImpl,
} from './dialog-runtime';
import { renderOverlayDialog as renderOverlayDialogImpl } from '../overlay/view';
import {
  clearActivePromptMenuCloseTimer as clearActivePromptMenuCloseTimerImpl,
  closeActivePromptMenu as closeActivePromptMenuImpl,
  createPromptMenuRuntimeOptions,
  refreshPrompts as refreshPromptsImpl,
  renderPromptMenuPortal as renderPromptMenuPortalImpl,
  renderPromptViewPanel as renderPromptViewPanelImpl,
  scheduleActivePromptMenuClose as scheduleActivePromptMenuCloseImpl,
  setActivePromptMenu as setActivePromptMenuImpl,
  syncPromptsSnapshot as syncPromptsSnapshotImpl,
  type PromptMenuRuntimeState,
} from './view-runtime';
import type { PromptEditorTab } from '../editor/types';
import type {
  ArchiveApplyWarningDialogState,
  PromptMenuState,
  PromptNameDialogState,
  PropertiesDialogState,
} from '../sidebar/types';
import type { ManagedMenuRuntimeOptions } from '../ui/menu-runtime';
import type { RendererClearTimeout, RendererSetTimeout } from '../app/timers';

export type PromptsFeature = {
  selectors: {
    getPromptById: (promptId: string) => PromptRecord | null;
    isPromptNameDialogOpen: () => boolean;
    isArchiveApplyWarningOpen: () => boolean;
    isPropertiesDialogOpen: () => boolean;
    isActivePromptMenuOpen: () => boolean;
  };
  actions: {
    syncPromptsSnapshot: (snapshot: PromptDirectorySnapshot) => void;
    refreshPrompts: (shouldRender?: boolean) => Promise<void>;
    clearActivePromptMenuCloseTimer: () => void;
    closeActivePromptMenu: (shouldRender?: boolean) => void;
    scheduleActivePromptMenuClose: (delayMs?: number) => void;
    setActivePromptMenu: (promptId: string, shouldToggle?: boolean) => void;
    openPromptNameDialog: (
      mode: 'create' | 'rename',
      options: { promptId?: string | null; initialValue?: string; title: string; confirmLabel: string },
    ) => void;
    openCreatePromptDialog: () => void;
    openRenamePromptDialog: (promptId: string, initialValue: string) => void;
    closePromptNameDialog: () => void;
    submitPromptNameDialog: (rawValue: string) => Promise<void>;
    openArchiveApplyWarningDialog: (file: ChatFileRecord, relativePath?: string | null) => void;
    closeArchiveApplyWarningDialog: () => void;
    openProjectPropertiesDialog: (projectId: string) => void;
    openChatPropertiesDialog: (projectId: string, chatId: string) => void;
    closePropertiesDialog: () => void;
    deletePrompt: (promptId: string) => Promise<void>;
  };
  render: {
    menuPortal: () => void;
    viewPanel: () => string;
    overlayDialog: () => void;
  };
};

export type PromptsFeatureBaseOptions = Omit<
  PromptsFeatureOptions,
  'normalizeEditorTabsState' | 'openPromptTab' | 'findPromptEditorTab' | 'getPromptEditorTabId' | 'closeEditorTab' | 'findChatEditorTab'
>;

export type PromptsFeatureOptions = {
  getCurrentState: () => AppStateSnapshot | null;
  getPromptDirectoryPath: () => string;
  setPromptDirectoryPath: (value: string) => void;
  getPrompts: () => PromptRecord[];
  setPrompts: (value: PromptRecord[]) => void;
  promptContentCache: Map<string, string>;
  getPromptMenuRuntimeState: () => PromptMenuRuntimeState;
  setPromptMenuRuntimeState: (nextState: PromptMenuRuntimeState) => void;
  getPromptNameDialogState: () => PromptNameDialogState | null;
  setPromptNameDialogState: (state: PromptNameDialogState | null) => void;
  getArchiveApplyWarningDialogState: () => ArchiveApplyWarningDialogState | null;
  setArchiveApplyWarningDialogState: (state: ArchiveApplyWarningDialogState | null) => void;
  getPropertiesDialogState: () => PropertiesDialogState;
  setPropertiesDialogState: (state: PropertiesDialogState) => void;
  listPrompts: () => Promise<PromptDirectorySnapshot>;
  readPrompt: (promptId: string) => Promise<{ prompt: PromptRecord; content: string } | null>;
  createPrompt: (name: string) => Promise<PromptRecord>;
  renamePrompt: (promptId: string, name: string) => Promise<PromptRecord>;
  deletePromptRecord: (promptId: string) => Promise<void>;
  normalizeEditorTabsState: () => void;
  openPromptTab: (promptId: string) => Promise<void>;
  findPromptEditorTab: (promptId: string) => PromptEditorTab | null;
  getPromptEditorTabId: (promptId: string) => string;
  getActiveEditorTabId: () => string;
  setActiveEditorTabId: (tabId: string) => void;
  closeEditorTab: (tabId: string) => void;
  findChatEditorTab: (projectId: string, chatId: string) => { history: { messageCount: number } | null } | null;
  renderApp: () => void;
  promptViewPanelElement: HTMLElement | null;
  overlayRootElement: HTMLElement;
  documentLike: Document;
  bodyElement: HTMLElement;
  windowLike: Window;
  getChatFileKey: (file: Pick<ChatFileRecord, 'projectId' | 'chatId' | 'messageId' | 'sandboxPath'>) => string;
  findLatestNewFileByKey: (fileKey: string) => { file: ChatFileRecord } | null;
  remoteManifestFile: string;
  getRemoteManifestPrompt: (projectId: string) => string;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  formatTimestamp: (value: string | null | undefined) => string;
  escapeHtml: (value: string | null | undefined) => string;
  renderOpenFolderIcon: () => string;
  renderFileTreeFileIcon: () => string;
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
  renderSharedFileTreeActionButton: (model: SharedFileTreeActionButtonModel) => string;
  renderMoreActionsIcon: () => string;
  setTimeoutImpl: RendererSetTimeout;
  clearTimeoutImpl: RendererClearTimeout;
};

export function createPromptsFeature(options: PromptsFeatureOptions): PromptsFeature {
  function renderOverlayDialog(): void {
    renderOverlayDialogImpl({
      overlayRootElement: options.overlayRootElement,
      promptNameDialogState: options.getPromptNameDialogState(),
      archiveApplyWarningDialogState: options.getArchiveApplyWarningDialogState(),
      setArchiveApplyWarningDialogState: options.setArchiveApplyWarningDialogState,
      propertiesDialogState: options.getPropertiesDialogState(),
      setPropertiesDialogState: options.setPropertiesDialogState,
      currentState: options.getCurrentState(),
      findLatestNewFileByKey: options.findLatestNewFileByKey,
      remoteManifestFile: options.remoteManifestFile,
      getRemoteManifestPrompt: options.getRemoteManifestPrompt,
      findSidebarProject: options.findSidebarProject,
      findSidebarChat: options.findSidebarChat,
      findChatEditorTab: options.findChatEditorTab,
      formatTimestamp: options.formatTimestamp,
      escapeHtml: options.escapeHtml,
    });
  }

  function getPromptMenuRuntimeOptions(): ManagedMenuRuntimeOptions<PromptMenuState> {
    return createPromptMenuRuntimeOptions({
      getState: options.getPromptMenuRuntimeState,
      setState: options.setPromptMenuRuntimeState,
      render: options.renderApp,
      setTimeoutImpl: options.setTimeoutImpl,
      clearTimeoutImpl: options.clearTimeoutImpl,
    });
  }

  function getPromptById(promptId: string): PromptRecord | null {
    return options.getPrompts().find((entry) => entry.id === promptId) ?? null;
  }

  function isPromptNameDialogOpen(): boolean {
    return Boolean(options.getPromptNameDialogState());
  }

  function isArchiveApplyWarningOpen(): boolean {
    return Boolean(options.getArchiveApplyWarningDialogState());
  }

  function isPropertiesDialogOpen(): boolean {
    return Boolean(options.getPropertiesDialogState());
  }

  function isActivePromptMenuOpen(): boolean {
    return Boolean(options.getPromptMenuRuntimeState().activePromptMenu);
  }

  function syncPromptsSnapshot(snapshot: PromptDirectorySnapshot): void {
    syncPromptsSnapshotImpl({
      snapshot,
      setPromptDirectoryPath: options.setPromptDirectoryPath,
      setPrompts: options.setPrompts,
      promptContentCache: options.promptContentCache,
      normalizeEditorTabsState: options.normalizeEditorTabsState,
    });
  }

  async function refreshPrompts(shouldRender = true): Promise<void> {
    await refreshPromptsImpl({
      shouldRender,
      listPrompts: options.listPrompts,
      readPrompt: options.readPrompt,
      promptContentCache: options.promptContentCache,
      setPromptDirectoryPath: options.setPromptDirectoryPath,
      setPrompts: options.setPrompts,
      normalizeEditorTabsState: options.normalizeEditorTabsState,
      render: options.renderApp,
    });
  }

  function clearActivePromptMenuCloseTimer(): void {
    clearActivePromptMenuCloseTimerImpl(getPromptMenuRuntimeOptions());
  }

  function closeActivePromptMenu(shouldRender = true): void {
    closeActivePromptMenuImpl(getPromptMenuRuntimeOptions(), shouldRender);
  }

  function scheduleActivePromptMenuClose(delayMs = 5000): void {
    scheduleActivePromptMenuCloseImpl(getPromptMenuRuntimeOptions(), delayMs);
  }

  function setActivePromptMenu(promptId: string, shouldToggle = true): void {
    setActivePromptMenuImpl({
      promptId,
      runtimeOptions: getPromptMenuRuntimeOptions(),
      shouldToggle,
    });
  }

  function renderPromptMenuPortal(): void {
    renderPromptMenuPortalImpl({
      activePromptMenu: options.getPromptMenuRuntimeState().activePromptMenu,
      prompts: options.getPrompts(),
      promptViewPanelElement: options.promptViewPanelElement,
      documentLike: options.documentLike,
      bodyElement: options.bodyElement,
      windowLike: options.windowLike,
      clearActivePromptMenuCloseTimer,
      scheduleActivePromptMenuClose: () => {
        scheduleActivePromptMenuClose();
      },
      escapeHtml: options.escapeHtml,
    });
  }

  function renderPromptViewPanel(): string {
    return renderPromptViewPanelImpl({
      promptDirectoryPath: options.getPromptDirectoryPath(),
      prompts: options.getPrompts(),
      activePromptMenuId: options.getPromptMenuRuntimeState().activePromptMenu?.promptId ?? null,
      activeEditorTabId: options.getActiveEditorTabId(),
      escapeHtml: options.escapeHtml,
      renderOpenFolderIcon: options.renderOpenFolderIcon,
      renderFileTreeFileIcon: options.renderFileTreeFileIcon,
      renderSharedFileTreeItem: options.renderSharedFileTreeItem,
      renderSharedFileTreeActionButton: options.renderSharedFileTreeActionButton,
      renderMoreActionsIcon: options.renderMoreActionsIcon,
      getPromptEditorTabId: options.getPromptEditorTabId,
    });
  }

  function openPromptNameDialog(
    mode: 'create' | 'rename',
    dialogOptions: { promptId?: string | null; initialValue?: string; title: string; confirmLabel: string },
  ): void {
    openPromptNameDialogImpl({
      mode,
      dialogOptions,
      setPromptNameDialogState: options.setPromptNameDialogState,
      renderOverlayDialog,
    });
  }

  function openCreatePromptDialog(): void {
    openPromptNameDialog('create', {
      title: 'New prompt',
      confirmLabel: 'Create',
      initialValue: 'New prompt.md',
    });
  }

  function openRenamePromptDialog(promptId: string, initialValue: string): void {
    openPromptNameDialog('rename', {
      promptId,
      title: 'Rename prompt',
      confirmLabel: 'Rename',
      initialValue,
    });
  }

  function closePromptNameDialog(): void {
    closePromptNameDialogImpl({
      setPromptNameDialogState: options.setPromptNameDialogState,
      renderOverlayDialog,
    });
  }

  async function submitPromptNameDialog(rawValue: string): Promise<void> {
    await submitPromptNameDialogImpl(rawValue, {
      promptNameDialogState: options.getPromptNameDialogState(),
      setPromptNameDialogState: options.setPromptNameDialogState,
      createPrompt: options.createPrompt,
      renamePrompt: options.renamePrompt,
      refreshPrompts: () => refreshPrompts(),
      openPromptTab: options.openPromptTab,
      promptContentCache: options.promptContentCache,
      findPromptEditorTab: options.findPromptEditorTab,
      getPromptEditorTabId: options.getPromptEditorTabId,
      activeEditorTabId: options.getActiveEditorTabId(),
      setActiveEditorTabId: options.setActiveEditorTabId,
      renderOverlayDialog,
    });
  }

  function openArchiveApplyWarningDialog(file: ChatFileRecord, relativePath?: string | null): void {
    options.setArchiveApplyWarningDialogState({ fileKey: options.getChatFileKey(file), relativePath: relativePath ?? null });
    renderOverlayDialog();
  }

  function closeArchiveApplyWarningDialog(): void {
    options.setArchiveApplyWarningDialogState(null);
    renderOverlayDialog();
  }

  function openProjectPropertiesDialog(projectId: string): void {
    options.setPropertiesDialogState({ kind: 'project', projectId });
    renderOverlayDialog();
  }

  function openChatPropertiesDialog(projectId: string, chatId: string): void {
    options.setPropertiesDialogState({ kind: 'chat', projectId, chatId });
    renderOverlayDialog();
  }

  function closePropertiesDialog(): void {
    options.setPropertiesDialogState(null);
    renderOverlayDialog();
  }

  async function deletePrompt(promptId: string): Promise<void> {
    await options.deletePromptRecord(promptId);
    options.promptContentCache.delete(promptId);
    const tab = options.findPromptEditorTab(promptId);
    if (tab) {
      options.closeEditorTab(tab.id);
    }
    await refreshPrompts();
  }

  return {
    selectors: {
      getPromptById,
      isPromptNameDialogOpen,
      isArchiveApplyWarningOpen,
      isPropertiesDialogOpen,
      isActivePromptMenuOpen,
    },
    actions: {
      syncPromptsSnapshot,
      refreshPrompts,
      clearActivePromptMenuCloseTimer,
      closeActivePromptMenu,
      scheduleActivePromptMenuClose,
      setActivePromptMenu,
      openPromptNameDialog,
      openCreatePromptDialog,
      openRenamePromptDialog,
      closePromptNameDialog,
      submitPromptNameDialog,
      openArchiveApplyWarningDialog,
      closeArchiveApplyWarningDialog,
      openProjectPropertiesDialog,
      openChatPropertiesDialog,
      closePropertiesDialog,
      deletePrompt,
    },
    render: {
      menuPortal: renderPromptMenuPortal,
      viewPanel: renderPromptViewPanel,
      overlayDialog: renderOverlayDialog,
    },
  };
}
