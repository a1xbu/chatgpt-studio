import type {
  AppStateSnapshot,
  ProjectChatRecord,
  SidebarProject,
} from '../../shared/contracts';
import type {
  RendererAppStoreSlice,
  RendererDialogStoreSlice,
  RendererEditorStoreSlice,
  RendererStore,
} from '../app/store';
import type { RendererUiRefs } from '../app/ui-refs';
import type { DesktopPocApi } from '../desktop-api';
import type { SharedFileTreeActionButtonModel, SharedFileTreeRowModel } from '../tree/shared-tree';
import type { RendererClearTimeout, RendererSetTimeout } from '../app/timers';
import type { PromptsFeatureBaseOptions } from './feature';

export type CreateRendererPromptsFeatureBaseOptionsArgs = {
  appState: RendererAppStoreSlice;
  dialogState: RendererDialogStoreSlice;
  editorState: RendererEditorStoreSlice;
  store: Pick<RendererStore, 'getPromptMenuRuntimeState' | 'setPromptMenuRuntimeState'>;
  desktopPoc: Pick<DesktopPocApi, 'listPrompts' | 'readPrompt' | 'createPrompt' | 'renamePrompt' | 'deletePrompt'>;
  renderApp: () => void;
  elements: Pick<RendererUiRefs, 'promptViewPanelElement' | 'overlayRootElement'>;
  environment: {
    documentLike: Document;
    bodyElement: HTMLElement;
    windowLike: Window;
  };
  remoteManifestFile: string;
  helpers: {
    getChatFileKey: PromptsFeatureBaseOptions['getChatFileKey'];
    findLatestNewFileByKey: PromptsFeatureBaseOptions['findLatestNewFileByKey'];
    getRemoteManifestPrompt: PromptsFeatureBaseOptions['getRemoteManifestPrompt'];
    findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
    formatTimestamp: PromptsFeatureBaseOptions['formatTimestamp'];
    escapeHtml: PromptsFeatureBaseOptions['escapeHtml'];
    renderOpenFolderIcon: PromptsFeatureBaseOptions['renderOpenFolderIcon'];
    renderFileTreeFileIcon: PromptsFeatureBaseOptions['renderFileTreeFileIcon'];
    renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
    renderSharedFileTreeActionButton: (model: SharedFileTreeActionButtonModel) => string;
    renderMoreActionsIcon: PromptsFeatureBaseOptions['renderMoreActionsIcon'];
  };
  timers: {
    setTimeoutImpl: RendererSetTimeout;
    clearTimeoutImpl: RendererClearTimeout;
  };
};

export function createRendererPromptsFeatureBaseOptions(
  args: CreateRendererPromptsFeatureBaseOptionsArgs,
): PromptsFeatureBaseOptions {
  return {
    getCurrentState: () => args.appState.currentState,
    getPromptDirectoryPath: () => args.editorState.promptDirectoryPath,
    setPromptDirectoryPath: (value) => {
      args.editorState.promptDirectoryPath = value;
    },
    getPrompts: () => args.editorState.prompts,
    setPrompts: (value) => {
      args.editorState.prompts = value;
    },
    promptContentCache: args.editorState.promptContentCache,
    getPromptMenuRuntimeState: args.store.getPromptMenuRuntimeState,
    setPromptMenuRuntimeState: args.store.setPromptMenuRuntimeState,
    getPromptNameDialogState: () => args.dialogState.promptNameDialogState,
    setPromptNameDialogState: (state) => {
      args.dialogState.promptNameDialogState = state;
    },
    getArchiveApplyWarningDialogState: () => args.dialogState.archiveApplyWarningDialogState,
    setArchiveApplyWarningDialogState: (state) => {
      args.dialogState.archiveApplyWarningDialogState = state;
    },
    getPropertiesDialogState: () => args.dialogState.propertiesDialogState,
    setPropertiesDialogState: (state) => {
      args.dialogState.propertiesDialogState = state;
    },
    listPrompts: () => args.desktopPoc.listPrompts(),
    readPrompt: (promptId) => args.desktopPoc.readPrompt(promptId),
    createPrompt: (name) => args.desktopPoc.createPrompt(name),
    renamePrompt: (promptId, name) => args.desktopPoc.renamePrompt(promptId, name),
    deletePromptRecord: async (promptId) => {
      await args.desktopPoc.deletePrompt(promptId);
    },
    getActiveEditorTabId: () => args.editorState.activeEditorTabId,
    setActiveEditorTabId: (tabId) => {
      args.editorState.activeEditorTabId = tabId;
    },
    renderApp: args.renderApp,
    promptViewPanelElement: args.elements.promptViewPanelElement,
    overlayRootElement: args.elements.overlayRootElement,
    documentLike: args.environment.documentLike,
    bodyElement: args.environment.bodyElement,
    windowLike: args.environment.windowLike,
    getChatFileKey: args.helpers.getChatFileKey,
    findLatestNewFileByKey: args.helpers.findLatestNewFileByKey,
    remoteManifestFile: args.remoteManifestFile,
    getRemoteManifestPrompt: args.helpers.getRemoteManifestPrompt,
    findSidebarProject: args.helpers.findSidebarProject,
    findSidebarChat: args.helpers.findSidebarChat,
    formatTimestamp: args.helpers.formatTimestamp,
    escapeHtml: args.helpers.escapeHtml,
    renderOpenFolderIcon: args.helpers.renderOpenFolderIcon,
    renderFileTreeFileIcon: args.helpers.renderFileTreeFileIcon,
    renderSharedFileTreeItem: args.helpers.renderSharedFileTreeItem,
    renderSharedFileTreeActionButton: args.helpers.renderSharedFileTreeActionButton,
    renderMoreActionsIcon: args.helpers.renderMoreActionsIcon,
    setTimeoutImpl: args.timers.setTimeoutImpl,
    clearTimeoutImpl: args.timers.clearTimeoutImpl,
  };
}
