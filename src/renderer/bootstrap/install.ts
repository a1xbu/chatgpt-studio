import type { AppStateSnapshot } from '../../shared/contracts';
import { installComposedRendererBindings, runComposedRendererBootstrap } from './composition';
import type { RendererBindingsAssemblyContext, RendererBootstrapAssemblyContext } from './renderer-context';

export async function runRendererBootstrapAssembly(context: RendererBootstrapAssemblyContext): Promise<void> {
  await runComposedRendererBootstrap({
    elements: context.elements,
    localStorage: context.localStorage,
    storageKeys: context.storageKeys,
    limits: context.limits,
    uiState: {
      ...context.sidebar.uiState,
      ...context.bottomPanel.uiState,
    },
    desktopPoc: context.desktopPoc,
    state: {
      ...context.state,
      ...context.bottomPanel.state,
      persistBrowserOpenedSelection: context.features.browser.actions.persistBrowserOpenedSelection,
    },
    actions: {
      syncProjectFileSignatures: context.features.files.actions.syncProjectFileSignatures,
      refreshPrompts: context.features.prompts.actions.refreshPrompts,
      createTerminalSessionState: context.bottomPanel.actions.createTerminalSessionState,
      resolveStartupBrowserUrl: (state, payload) => (state
        ? context.features.browser.selectors.resolvePreferredStartupBrowserUrl(state)
        : payload.browser.url),
      resolveStartupBrowserSelection: (state) => (state
        ? context.features.browser.selectors.resolvePreferredStartupBrowserSelection(state)
        : null),
      queueAutomaticSandboxDownloads: context.features.browser.actions.queueAutomaticSandboxDownloads,
      render: context.shell.render,
      restoreLastOpenState: context.features.browser.actions.restoreLastOpenState,
      addDebugLog: context.bottomPanel.actions.addDebugLog,
      pushDebugLogEntry: context.bottomPanel.actions.pushDebugLogEntry,
      handleChatHistoryUpdated: context.workbench.actions.handleChatHistoryUpdated,
      handleBrowserDidStartLoading: context.features.browser.actions.handleWebviewDidStartLoading,
      handleBrowserDidFinishLoad: context.features.browser.actions.handleWebviewDidFinishLoad,
      handleBrowserDidStopLoading: context.features.browser.actions.handleWebviewDidStopLoading,
      handleBrowserDidFailLoad: context.features.browser.actions.handleWebviewDidFailLoad,
      handleBrowserDidNavigate: context.features.browser.actions.handleWebviewDidNavigate,
      handleBrowserDomReady: context.features.browser.actions.handleWebviewDomReady,
      handleBrowserSandboxFileStatus: context.features.browser.actions.handleBrowserSandboxFileStatus,
      handleTerminalData: context.bottomPanel.actions.handleTerminalData,
      handleTerminalExit: context.bottomPanel.actions.handleTerminalExit,
      scheduleTerminalFit: context.bottomPanel.actions.scheduleTerminalFit,
    },
    browserController: {
      updateUrl: context.browserController.updateUrl,
      syncControls: context.browserController.syncControls,
    },
    fileDownloadStatuses: context.fileDownloadStatuses,
  });
}

export function installRendererFeatureBindings(context: RendererBindingsAssemblyContext): void {
  installComposedRendererBindings({
    elements: context.elements,
    localStorage: context.localStorage,
    desktopPoc: context.desktopPoc,
    browserController: context.browserController,
    promptContentCache: context.promptContentCache,
    prompts: context.prompts,
    expandedProjectIds: context.expandedProjectIds,
    expandedLocalDirectoryKeys: context.expandedLocalDirectoryKeys,
    projectBundleCreateInFlightIds: context.projectBundleCreateInFlightIds,
    projectBundleErrorsByProjectId: context.projectBundleErrorsByProjectId,
    localFileEntriesByKey: context.localFileEntriesByKey,
    collapsedGitCommitDirectoryKeys: context.collapsedGitCommitDirectoryKeys,
    archiveEntriesByFileKey: context.archiveEntriesByFileKey,
    expandedNewFilesKeys: context.expandedNewFilesKeys,
    fileDownloadStatuses: context.fileDownloadStatuses,
    constants: context.constants,
    state: {
      ...context.state,
      ...context.sidebar.state,
      ...context.browser.state,
      ...context.remoteFiles.state,
      ...context.bottomPanel.state,
      setPropertiesDialogProject: context.features.prompts.actions.openProjectPropertiesDialog,
      setPropertiesDialogChat: context.features.prompts.actions.openChatPropertiesDialog,
      isPromptNameDialogOpen: context.features.prompts.selectors.isPromptNameDialogOpen,
      isArchiveApplyWarningOpen: context.features.prompts.selectors.isArchiveApplyWarningOpen,
      closePropertiesDialog: context.features.prompts.actions.closePropertiesDialog,
      isPropertiesDialogOpen: context.features.prompts.selectors.isPropertiesDialogOpen,
      isActivePromptMenuOpen: context.features.prompts.selectors.isActivePromptMenuOpen,
      closeActivePromptMenu: () => {
        context.features.prompts.actions.closeActivePromptMenu(true);
      },
      getPromptById: context.features.prompts.selectors.getPromptById,
    },
    actions: {
      ...context.actions,
      ...context.sidebar.actions,
      ...context.browser.actions,
      ...context.remoteFiles.actions,
      ...context.bottomPanel.actions,
      ensureFilesViewLoaded: () => {
        const currentState = context.state.getCurrentState();
        if (currentState) {
          context.features.files.actions.ensureLocalFileTreeForState(currentState);
        }
      },
      refreshLocalProjectTree: context.features.files.actions.refreshLocalProjectTree,
      renderFileViewPanel: (state, preserveScroll) => {
        const appState = context.actions.renderFileViewPanelStateCast
          ? context.actions.renderFileViewPanelStateCast(state)
          : state as AppStateSnapshot;
        context.features.files.render.fileViewPanel(appState, preserveScroll);
      },
      loadLocalFileTree: context.features.files.actions.loadLocalFileTree,
      openCreatePromptDialog: context.features.prompts.actions.openCreatePromptDialog,
      setActivePromptMenu: context.features.prompts.actions.setActivePromptMenu,
      openPromptTab: context.workbench.actions.openPromptTab,
      findPromptEditorTab: context.workbench.actions.findPromptEditorTab,
      enterPromptEditMode: context.workbench.actions.enterPromptEditMode,
      savePromptTab: context.workbench.actions.savePromptTab,
      cancelPromptEditing: context.workbench.actions.cancelPromptEditing,
      closeEditorTab: context.workbench.actions.closeEditorTab,
      activatePairedEditorView: context.workbench.actions.activatePairedEditorView,
      activateEditorTab: context.workbench.actions.activateEditorTab,
      openChatHistoryTab: context.workbench.actions.openChatHistoryTab,
      getChatEditorTabId: context.workbench.actions.getChatEditorTabId,
      hasEditorTab: context.workbench.actions.hasEditorTab,
      submitPromptNameDialog: context.features.prompts.actions.submitPromptNameDialog,
      closePromptNameDialog: context.features.prompts.actions.closePromptNameDialog,
      closeArchiveApplyWarningDialog: context.features.prompts.actions.closeArchiveApplyWarningDialog,
      openRenamePromptDialog: context.features.prompts.actions.openRenamePromptDialog,
      deletePrompt: context.features.prompts.actions.deletePrompt,
      openArchiveApplyWarningDialog: context.features.prompts.actions.openArchiveApplyWarningDialog,
      openLocalChatInChatGpt: context.workbench.actions.openLocalChatInChatGpt,
      isBrowserPairedWithChat: context.workbench.actions.isBrowserPairedWithChat,
      openBrowserForPairedChat: context.workbench.actions.openBrowserForPairedChat,
    },
    alert: context.alert,
    confirm: context.confirm,
  });
}
