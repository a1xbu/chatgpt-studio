import type { ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import type { ChatHistoryUpdatePayload } from '../desktop-api';
import type { RendererRenderHooks } from '../app/context';
import type { RendererAppStoreSlice, RendererEditorStoreSlice } from '../app/store';
import type { BrowserFeature } from '../browser/feature';
import type { EditorFeature } from '../editor/feature';
import type { EditorTabState, ChatEditorTab, PromptEditorTab } from '../editor/types';

export type RendererWorkbenchBootstrapActions = {
  handleChatHistoryUpdated: (payload: ChatHistoryUpdatePayload) => void;
};

export type RendererWorkbenchBootstrapSlice = {
  actions: RendererWorkbenchBootstrapActions;
};

export type RendererWorkbenchBindingsActions = {
  openPromptTab: (promptId: string) => Promise<void>;
  findPromptEditorTab: (promptId: string) => PromptEditorTab | null;
  enterPromptEditMode: (promptId: string) => void;
  savePromptTab: (promptId: string) => void;
  cancelPromptEditing: (promptId: string) => void;
  closeEditorTab: (tabId: string) => void;
  activatePairedEditorView: (view: 'browser' | 'local') => void;
  activateEditorTab: (tabId: string) => void;
  openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => Promise<void>;
  getChatEditorTabId: (projectId: string, chatId: string) => string;
  hasEditorTab: (tabId: string) => boolean;
  isBrowserPairedWithChat: (projectId: string, chatId: string) => boolean;
  openBrowserForPairedChat: (projectId: string, chatId: string, activateBrowser?: boolean) => boolean;
  openLocalChatInChatGpt: (projectId: string, chatId: string, chatUrl: string) => void;
};

export type RendererWorkbenchBindingsSlice = {
  actions: RendererWorkbenchBindingsActions;
};

export type RendererWorkbenchContextRenderHooks = Pick<
  RendererRenderHooks,
  | 'renderEditorArea'
  | 'syncSelectionWithActiveEditorTab'
  | 'persistActiveLocalChatSelection'
  | 'loadChatHistoryIntoTab'
  | 'loadPromptIntoTab'
  | 'savePromptTab'
>;

export type RendererWorkbenchBrowserControllerHooks = {
  activateBrowserTab: () => void;
  renderActivatedView: () => void;
};

type RendererWorkbenchHostFeatures = {
  browser: () => Pick<BrowserFeature, 'actions' | 'selectors'>;
  editor: () => Pick<EditorFeature, 'actions' | 'render' | 'selectors'>;
};

export type RendererWorkbenchHost = {
  getActiveEditorTabId: () => EditorTabState['id'];
  setActiveEditorTabId: (tabId: EditorTabState['id']) => void;
  setActivePairedEditorSubtab: (value: 'browser' | 'local') => void;
  renderEditorArea: () => void;
  hasEditorTab: (tabId: string) => boolean;
  renderWorkbench: () => void;
  createBrowserControllerHooks: () => RendererWorkbenchBrowserControllerHooks;
  createBootstrapSlice: () => RendererWorkbenchBootstrapSlice;
  createBindingsSlice: () => RendererWorkbenchBindingsSlice;
  createContextRenderHooks: () => RendererWorkbenchContextRenderHooks;
};

export type CreateRendererWorkbenchHostOptions = {
  appState: RendererAppStoreSlice;
  editorState: Pick<RendererEditorStoreSlice, 'editorTabs' | 'activeEditorTabId' | 'activePairedEditorSubtab'>;
  persistActiveLocalChatSelection: () => void;
  getFeatures: () => RendererWorkbenchHostFeatures;
};

export function createRendererWorkbenchHost(
  options: CreateRendererWorkbenchHostOptions,
): RendererWorkbenchHost {
  const getActiveEditorTabId = (): EditorTabState['id'] => options.editorState.activeEditorTabId;
  const setActiveEditorTabId = (tabId: EditorTabState['id']): void => {
    options.editorState.activeEditorTabId = tabId;
  };
  const setActivePairedEditorSubtab = (value: 'browser' | 'local'): void => {
    options.editorState.activePairedEditorSubtab = value;
  };
  const hasEditorTab = (tabId: string): boolean => options.editorState.editorTabs.some((tab) => tab.id === tabId);

  function getEditorFeature(): ReturnType<RendererWorkbenchHostFeatures['editor']> {
    return options.getFeatures().editor();
  }

  function getBrowserFeature(): ReturnType<RendererWorkbenchHostFeatures['browser']> {
    return options.getFeatures().browser();
  }

  function renderEditorArea(): void {
    getEditorFeature().render.area();
  }

  function renderWorkbench(): void {
    const currentState = options.appState.currentState;
    if (!currentState) {
      return;
    }

    getBrowserFeature().actions.syncBrowserOpenedSelection(currentState);
    getEditorFeature().render.area();
    getEditorFeature().render.promptSidebarPanel();
  }

  function createBrowserControllerHooks(): RendererWorkbenchBrowserControllerHooks {
    return {
      activateBrowserTab: () => {
        setActiveEditorTabId('browser');
      },
      renderActivatedView: renderEditorArea,
    };
  }

  function createBootstrapSlice(): RendererWorkbenchBootstrapSlice {
    return {
      actions: {
        handleChatHistoryUpdated: (payload: ChatHistoryUpdatePayload) => {
          getEditorFeature().actions.handleChatHistoryUpdated(payload);
        },
      },
    };
  }

  function createBindingsSlice(): RendererWorkbenchBindingsSlice {
    return {
      actions: {
        openPromptTab: (promptId: string) => getEditorFeature().actions.openPromptTab(promptId),
        findPromptEditorTab: (promptId: string) => getEditorFeature().selectors.findPromptEditorTab(promptId),
        enterPromptEditMode: (promptId: string) => {
          const tab = getEditorFeature().selectors.findPromptEditorTab(promptId);
          if (tab) {
            getEditorFeature().actions.enterPromptEditMode(tab);
          }
        },
        savePromptTab: (promptId: string) => {
          const tab = getEditorFeature().selectors.findPromptEditorTab(promptId);
          if (tab) {
            void getEditorFeature().actions.savePromptTab(tab);
          }
        },
        cancelPromptEditing: (promptId: string) => {
          const tab = getEditorFeature().selectors.findPromptEditorTab(promptId);
          if (tab) {
            getEditorFeature().actions.cancelPromptEditing(tab);
          }
        },
        closeEditorTab: (tabId: string) => {
          getEditorFeature().actions.closeEditorTab(tabId);
        },
        activatePairedEditorView: (view: 'browser' | 'local') => {
          getEditorFeature().actions.activatePairedEditorView(view);
        },
        activateEditorTab: (tabId: string) => {
          getEditorFeature().actions.activateEditorTab(tabId);
        },
        openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => (
          getEditorFeature().actions.openChatHistoryTab(project, chat)
        ),
        getChatEditorTabId: (projectId: string, chatId: string) => (
          getEditorFeature().selectors.getChatEditorTabId(projectId, chatId)
        ),
        hasEditorTab,
        isBrowserPairedWithChat: (projectId: string, chatId: string) => (
          getBrowserFeature().selectors.isBrowserPairedWithChat(projectId, chatId)
        ),
        openBrowserForPairedChat: (projectId: string, chatId: string, activateBrowser?: boolean) => (
          getBrowserFeature().actions.openBrowserForPairedChat(projectId, chatId, activateBrowser)
        ),
        openLocalChatInChatGpt: (projectId: string, chatId: string, chatUrl: string) => {
          getBrowserFeature().actions.openLocalChatInChatGpt(projectId, chatId, chatUrl);
        },
      },
    };
  }

  function createContextRenderHooks(): RendererWorkbenchContextRenderHooks {
    return {
      renderEditorArea,
      syncSelectionWithActiveEditorTab: () => {
        getEditorFeature().actions.syncSelectionWithActiveEditorTab();
      },
      persistActiveLocalChatSelection: options.persistActiveLocalChatSelection,
      loadChatHistoryIntoTab: (tab: ChatEditorTab, forceReload?: boolean) => (
        getEditorFeature().actions.loadChatHistoryIntoTab(tab, forceReload)
      ),
      loadPromptIntoTab: (tab: PromptEditorTab, forceReload?: boolean) => (
        getEditorFeature().actions.loadPromptIntoTab(tab, forceReload)
      ),
      savePromptTab: (tab: PromptEditorTab) => getEditorFeature().actions.savePromptTab(tab),
    };
  }

  return {
    getActiveEditorTabId,
    setActiveEditorTabId,
    setActivePairedEditorSubtab,
    renderEditorArea,
    hasEditorTab,
    renderWorkbench,
    createBrowserControllerHooks,
    createBootstrapSlice,
    createBindingsSlice,
    createContextRenderHooks,
  };
}
