import { createRendererFeatureComposition, type RendererFeatureComposition } from '../bootstrap/renderer-context';
import { createBottomPanelFeature, type BottomPanelFeature, type BottomPanelFeatureBaseOptions } from '../bottom-panel/feature';
import { createBrowserFeature, type BrowserFeature, type BrowserFeatureBaseOptions } from '../browser/feature';
import { createEditorFeature, type EditorFeature, type EditorFeatureBaseOptions } from '../editor/feature';
import { createFilesFeature, type FilesFeature, type FilesFeatureOptions } from '../files/feature';
import { createPromptsFeature, type PromptsFeature, type PromptsFeatureBaseOptions } from '../prompts/feature';
import { createSidebarFeature, type SidebarFeature, type SidebarFeatureOptions } from '../sidebar/feature';

export type RendererFeatureRegistry = {
  sidebar: () => SidebarFeature;
  files: () => FilesFeature;
  prompts: () => PromptsFeature;
  editor: () => EditorFeature;
  browser: () => BrowserFeature;
  bottomPanel: () => BottomPanelFeature;
  composition: () => RendererFeatureComposition;
};

type RendererEditorFeatureBaseOptions = EditorFeatureBaseOptions;
type RendererPromptsFeatureBaseOptions = PromptsFeatureBaseOptions;
type RendererBrowserFeatureBaseOptions = BrowserFeatureBaseOptions;
type RendererBottomPanelFeatureBaseOptions = BottomPanelFeatureBaseOptions;

export type RendererFeatureRegistryOptions = {
  sidebar: SidebarFeatureOptions;
  files: FilesFeatureOptions;
  prompts: RendererPromptsFeatureBaseOptions;
  editor: RendererEditorFeatureBaseOptions;
  browser: RendererBrowserFeatureBaseOptions;
  bottomPanel: RendererBottomPanelFeatureBaseOptions;
};

export function createRendererFeatureRegistry(options: RendererFeatureRegistryOptions): RendererFeatureRegistry {
  let sidebarFeature: SidebarFeature | null = null;
  let filesFeature: FilesFeature | null = null;
  let promptsFeature: PromptsFeature | null = null;
  let editorFeature: EditorFeature | null = null;
  let browserFeature: BrowserFeature | null = null;
  let bottomPanelFeature: BottomPanelFeature | null = null;

  function sidebar(): SidebarFeature {
    if (!sidebarFeature) {
      sidebarFeature = createSidebarFeature(options.sidebar);
    }

    return sidebarFeature;
  }

  function files(): FilesFeature {
    if (!filesFeature) {
      filesFeature = createFilesFeature(options.files);
    }

    return filesFeature;
  }

  function prompts(): PromptsFeature {
    if (!promptsFeature) {
      promptsFeature = createPromptsFeature({
        ...options.prompts,
        normalizeEditorTabsState: () => editor().actions.normalizeEditorTabsState(),
        openPromptTab: (promptId) => editor().actions.openPromptTab(promptId),
        findPromptEditorTab: (promptId) => editor().selectors.findPromptEditorTab(promptId),
        getPromptEditorTabId: (promptId) => editor().selectors.getPromptEditorTabId(promptId),
        closeEditorTab: (tabId) => editor().actions.closeEditorTab(tabId),
        findChatEditorTab: (projectId, chatId) => editor().selectors.findChatEditorTab(projectId, chatId),
      });
    }

    return promptsFeature;
  }

  function editor(): EditorFeature {
    if (!editorFeature) {
      editorFeature = createEditorFeature({
        ...options.editor,
        refreshPrompts: (shouldRender) => prompts().actions.refreshPrompts(shouldRender),
        renderPromptMenuPortal: () => prompts().render.menuPortal(),
        renderPromptViewPanel: () => prompts().render.viewPanel(),
      });
    }

    return editorFeature;
  }

  function bottomPanel(): BottomPanelFeature {
    if (!bottomPanelFeature) {
      bottomPanelFeature = createBottomPanelFeature({
        ...options.bottomPanel,
        getActiveSidebarProject: (state) => sidebar().selectors.getActiveSidebarProject(state),
      });
    }

    return bottomPanelFeature;
  }

  function browser(): BrowserFeature {
    if (!browserFeature) {
      browserFeature = createBrowserFeature({
        ...options.browser,
        ensureChatHistoryTab: (project, chat, activate) => editor().actions.ensureChatHistoryTab(project, chat, activate),
        openChatHistoryTab: (project, chat) => editor().actions.openChatHistoryTab(project, chat),
        activateEditorTab: (tabId) => {
          editor().actions.activateEditorTab(tabId);
        },
        reloadChatHistoryIntoTab: (tab, forceReload) => editor().actions.loadChatHistoryIntoTab(tab, forceReload),
        markChatEditorTabStale: (projectId, chatId, staleOptions) => editor().actions.markChatHistoryTabStale(projectId, chatId, staleOptions),
        findChatEditorTab: (projectId, chatId) => editor().selectors.findChatEditorTab(projectId, chatId),
        addDebugLog: (source, level, message, details) => {
          bottomPanel().actions.addDebugLog(source, level, message, details);
        },
      });
    }

    return browserFeature;
  }

  function composition(): RendererFeatureComposition {
    return createRendererFeatureComposition({
      sidebar: sidebar(),
      files: files(),
      prompts: prompts(),
      editor: editor(),
      browser: browser(),
      bottomPanel: bottomPanel(),
    });
  }

  return {
    sidebar,
    files,
    prompts,
    editor,
    browser,
    bottomPanel,
    composition,
  };
}
