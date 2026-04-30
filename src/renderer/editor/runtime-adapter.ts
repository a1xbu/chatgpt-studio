import type { ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import {
  activateEditorTab as activateEditorTabRuntime,
  activatePairedEditorView as activatePairedEditorViewRuntime,
  closeEditorTab as closeEditorTabRuntime,
  ensureChatHistoryTab as ensureChatHistoryTabRuntime,
  type EditorRuntimeCallbacks,
  type EditorRuntimeState,
} from './runtime';
import type { ChatEditorTab, PromptEditorTab } from './types';

export type EditorRuntimeAdapterOptions = EditorRuntimeCallbacks & {
  getState: () => EditorRuntimeState;
  setState: (nextState: EditorRuntimeState) => void;
  maxOpenChatTabs: number;
  isBrowserPairedWithChat: (projectId: string, chatId: string) => boolean;
};

export type EditorRuntimeAdapter = {
  ensureChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord, activate?: boolean) => Promise<ChatEditorTab>;
  activateEditorTab: (tabId: string) => void;
  activatePairedEditorView: (nextView: 'browser' | 'local') => void;
  openChatHistoryTab: (project: SidebarProject, chat: ProjectChatRecord) => Promise<void>;
  closeEditorTab: (tabId: string) => void;
};

function getRuntimeCallbacks(options: EditorRuntimeAdapterOptions): EditorRuntimeCallbacks {
  return {
    getPairedChatEditorTab: options.getPairedChatEditorTab,
    persistActiveLocalChatSelection: options.persistActiveLocalChatSelection,
    syncSelectionWithActiveEditorTab: options.syncSelectionWithActiveEditorTab,
    render: options.render,
    renderEditorArea: options.renderEditorArea,
    loadChatHistoryIntoTab: options.loadChatHistoryIntoTab,
    loadPromptIntoTab: options.loadPromptIntoTab,
    savePromptTab: options.savePromptTab,
  };
}

export function createEditorRuntimeAdapter(options: EditorRuntimeAdapterOptions): EditorRuntimeAdapter {
  const callbacks = getRuntimeCallbacks(options);

  return {
    ensureChatHistoryTab: (project, chat, activate = false) => ensureChatHistoryTabRuntime({
      project,
      chat,
      activate,
      state: options.getState(),
      setState: options.setState,
      maxOpenChatTabs: options.maxOpenChatTabs,
      ...callbacks,
    }),
    activateEditorTab: (tabId) => {
      activateEditorTabRuntime({
        tabId,
        state: options.getState(),
        setState: options.setState,
        ...callbacks,
      });
    },
    activatePairedEditorView: (nextView) => {
      activatePairedEditorViewRuntime({
        nextView,
        state: options.getState(),
        setState: options.setState,
        ...callbacks,
      });
    },
    openChatHistoryTab: async (project, chat) => {
      if (options.isBrowserPairedWithChat(project.projectId, chat.chatId)) {
        await ensureChatHistoryTabRuntime({
          project,
          chat,
          activate: false,
          state: options.getState(),
          setState: options.setState,
          maxOpenChatTabs: options.maxOpenChatTabs,
          ...callbacks,
        });
        activatePairedEditorViewRuntime({
          nextView: 'local',
          state: options.getState(),
          setState: options.setState,
          ...callbacks,
        });
        return;
      }

      await ensureChatHistoryTabRuntime({
        project,
        chat,
        activate: true,
        state: options.getState(),
        setState: options.setState,
        maxOpenChatTabs: options.maxOpenChatTabs,
        ...callbacks,
      });
    },
    closeEditorTab: (tabId) => {
      closeEditorTabRuntime({
        tabId,
        state: options.getState(),
        setState: options.setState,
        ...callbacks,
      });
    },
  };
}
