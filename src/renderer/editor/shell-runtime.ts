import type {
  ChatHistoryRecord,
  DebugLogEntry,
  ProjectChatRecord,
  PromptRecord,
  SidebarProject,
} from '../../shared/contracts';
import type {
  RendererAppStoreSlice,
  RendererBrowserStoreSlice,
  RendererEditorStoreSlice,
  RendererStore,
  RendererWorkspaceStoreSlice,
} from '../app/store';
import type { RendererUiRefs } from '../app/ui-refs';
import type { DesktopPocApi } from '../desktop-api';
import type { MarkdownItInstance } from '../runtime-types';
import { persistActiveLocalChatSelection as persistActiveLocalChatSelectionImpl } from '../sidebar/runtime';
import type { SidebarSelection } from '../sidebar/types';
import type { ChatEditorTab } from './types';
import type { EditorFeatureBaseOptions } from './feature';

export type CreateRendererEditorFeatureBaseOptionsArgs = {
  limits: {
    maxOpenChatTabs: number;
    maxOpenPromptTabs: number;
    editorTabBaseWidthPx: number;
    editorTabMinWidthPx: number;
  };
  appState: RendererAppStoreSlice;
  workspaceState: RendererWorkspaceStoreSlice;
  browserState: RendererBrowserStoreSlice;
  editorState: RendererEditorStoreSlice;
  store: Pick<RendererStore, 'getEditorRuntimeState' | 'setEditorRuntimeState'>;
  desktopPoc: Pick<DesktopPocApi, 'readPrompt' | 'writePrompt' | 'getChatHistory' | 'getChatMessageThoughts'>;
  storage: Storage;
  storageKeys: {
    lastActiveLocalChat: string;
  };
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  getPairedChatEditorTab: () => ChatEditorTab | null;
  renderApp: () => void;
  renderEditorArea: () => void;
  addDebugLog: (
    source: DebugLogEntry['source'],
    level: DebugLogEntry['level'],
    message: string,
    details?: string | null,
  ) => void;
  queries: {
    findSidebarProject: (state: any, projectId: string) => SidebarProject | null;
    findPersistentSidebarProject: (state: any, projectId: string) => SidebarProject | null;
    findSidebarChat: (state: any, projectId: string, chatId: string) => ProjectChatRecord | null;
    resolveChatBrowserUrl: (project: SidebarProject, chat: ProjectChatRecord) => string;
    buildChatBrowserUrl: (projectId: string, chatId: string, projectUrl: string | null) => string;
  };
  markdownRenderer: MarkdownItInstance;
  formatters: {
    escapeHtml: (value: string | null | undefined) => string;
    formatTimestamp: (value: string | null | undefined) => string;
    formatTreeTimestamp: (value: string | null | undefined) => string;
    formatFileSize: (value: number | null | undefined) => string;
  };
  icons: {
    renderBrowserTabIcon: () => string;
    renderChatIcon: () => string;
    renderPromptIcon: () => string;
    renderCloseIcon: () => string;
    renderGenericFileIcon: () => string;
  };
  elements: Pick<
    RendererUiRefs,
    | 'editorTabsElement'
    | 'promptViewPanelElement'
    | 'promptEditorViewElement'
    | 'workbenchElement'
    | 'browserToolbarElement'
    | 'browserToolbarControlsElement'
    | 'browserAddressFormElement'
    | 'browserViewElement'
    | 'chatHistoryViewElement'
    | 'browserElement'
  >;
};

export function createRendererEditorFeatureBaseOptions(
  args: CreateRendererEditorFeatureBaseOptionsArgs,
): EditorFeatureBaseOptions {
  return {
    maxOpenChatTabs: args.limits.maxOpenChatTabs,
    maxOpenPromptTabs: args.limits.maxOpenPromptTabs,
    editorTabBaseWidthPx: args.limits.editorTabBaseWidthPx,
    editorTabMinWidthPx: args.limits.editorTabMinWidthPx,
    getCurrentState: () => args.appState.currentState,
    getSelectedSidebarItem: () => args.workspaceState.selectedSidebarItem,
    setSelectedSidebarItem: args.setSelectedSidebarItem,
    getBrowserOpenedSidebarItem: () => args.browserState.browserOpenedSidebarItem,
    getPrompts: () => args.editorState.prompts,
    promptContentCache: args.editorState.promptContentCache,
    readPrompt: (promptId) => args.desktopPoc.readPrompt(promptId) as Promise<{ prompt: PromptRecord; content: string } | null>,
    writePrompt: (promptId, content) => args.desktopPoc.writePrompt(promptId, content) as Promise<PromptRecord>,
    getEditorRuntimeState: args.store.getEditorRuntimeState,
    setEditorRuntimeState: args.store.setEditorRuntimeState,
    getLastRenderedPromptEditorStateKey: () => args.editorState.lastRenderedPromptEditorStateKey,
    setLastRenderedPromptEditorStateKey: (value) => {
      args.editorState.lastRenderedPromptEditorStateKey = value;
    },
    findSidebarProject: args.queries.findSidebarProject,
    findPersistentSidebarProject: args.queries.findPersistentSidebarProject,
    findSidebarChat: args.queries.findSidebarChat,
    resolveChatBrowserUrl: args.queries.resolveChatBrowserUrl,
    buildChatBrowserUrl: args.queries.buildChatBrowserUrl,
    renderApp: args.renderApp,
    persistActiveLocalChatSelection: () => {
      persistActiveLocalChatSelectionImpl({
        storage: args.storage,
        storageKey: args.storageKeys.lastActiveLocalChat,
        editorTabs: args.editorState.editorTabs,
        activeEditorTabId: args.editorState.activeEditorTabId,
        activePairedEditorSubtab: args.editorState.activePairedEditorSubtab,
        getPairedChatEditorTab: args.getPairedChatEditorTab,
      });
    },
    addDebugLog: args.addDebugLog,
    getChatHistory: (projectId, chatId) => args.desktopPoc.getChatHistory(projectId, chatId) as Promise<ChatHistoryRecord | null>,
    getChatMessageThoughts: args.desktopPoc.getChatMessageThoughts
      ? (projectId: string, chatId: string, messageId: string) =>
          args.desktopPoc.getChatMessageThoughts(projectId, chatId, messageId)
      : undefined,
    markdownRenderer: args.markdownRenderer,
    escapeHtml: args.formatters.escapeHtml,
    formatTimestamp: args.formatters.formatTimestamp,
    formatTreeTimestamp: args.formatters.formatTreeTimestamp,
    formatFileSize: args.formatters.formatFileSize,
    renderBrowserTabIcon: args.icons.renderBrowserTabIcon,
    renderChatIcon: args.icons.renderChatIcon,
    renderPromptIcon: args.icons.renderPromptIcon,
    renderCloseIcon: args.icons.renderCloseIcon,
    renderGenericFileIcon: args.icons.renderGenericFileIcon,
    editorTabsElement: args.elements.editorTabsElement,
    promptViewPanelElement: args.elements.promptViewPanelElement,
    promptEditorViewElement: args.elements.promptEditorViewElement,
    workbenchElement: args.elements.workbenchElement,
    browserToolbarElement: args.elements.browserToolbarElement,
    browserToolbarControlsElement: args.elements.browserToolbarControlsElement,
    browserAddressFormElement: args.elements.browserAddressFormElement,
    browserViewElement: args.elements.browserViewElement,
    chatHistoryViewElement: args.elements.chatHistoryViewElement,
    browserElement: args.elements.browserElement,
  };
}
