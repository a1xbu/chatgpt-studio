import type { ChatEditorTab, EditorTabState, PromptEditorTab } from './types';
import { buildEditorTabsMarkup } from './tabs';
import { renderEditorSurface as renderEditorSurfaceImpl } from './surface';
import type { SidebarSelection } from '../sidebar/types';

export type RenderEditorTabsOptions = {
  editorTabsElement: HTMLElement | null;
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
  currentStateIsReady: boolean;
  pairedSelection: Extract<SidebarSelection, { kind: 'chat' }> | null;
  findPairedChatLabel: (selection: Extract<SidebarSelection, { kind: 'chat' }>) => string | null;
  normalizeEditorTabsState: () => void;
  escapeHtml: (value: string | null | undefined) => string;
  renderBrowserTabIcon: () => string;
  renderChatIcon: () => string;
  renderPromptIcon: () => string;
  renderCloseIcon: () => string;
};

export function renderEditorTabs(options: RenderEditorTabsOptions): void {
  if (!options.editorTabsElement) {
    return;
  }

  options.normalizeEditorTabsState();
  const pairedLabel = options.pairedSelection && options.currentStateIsReady
    ? options.findPairedChatLabel(options.pairedSelection) ?? 'Paired chat'
    : 'Browser';

  options.editorTabsElement.innerHTML = buildEditorTabsMarkup(
    {
      editorTabs: options.editorTabs,
      activeEditorTabId: options.activeEditorTabId,
      activePairedEditorSubtab: options.activePairedEditorSubtab,
      pairedSelection: options.pairedSelection,
      pairedLabel,
    },
    {
      escapeHtml: options.escapeHtml,
      renderBrowserTabIcon: options.renderBrowserTabIcon,
      renderChatIcon: options.renderChatIcon,
      renderPromptIcon: options.renderPromptIcon,
      renderCloseIcon: options.renderCloseIcon,
    },
  );
}

export type RenderEditorAreaOptions = RenderEditorTabsOptions & {
  lastRenderedPromptEditorStateKey: string;
  updateEditorTabBarLayout: () => void;
  workbenchElement: HTMLElement | null;
  browserToolbarElement: HTMLElement | null;
  browserToolbarControlsElement: HTMLElement | null;
  browserAddressFormElement: HTMLFormElement | null;
  browserViewElement: HTMLElement | null;
  chatHistoryViewElement: HTMLElement | null;
  promptEditorViewElement: HTMLElement | null;
  browserElement: HTMLElement | null;
  getPairedChatEditorTab: () => ChatEditorTab | null;
  createChatHistoryTabContent: (tab: ChatEditorTab) => HTMLElement;
  createPromptEditorContent: (tab: PromptEditorTab) => HTMLElement;
  renderPromptMenuPortal: () => void;
  setActivePairedEditorSubtab: (value: 'browser' | 'local') => void;
  setLastRenderedPromptEditorStateKey: (value: string) => void;
};

export function renderEditorArea(options: RenderEditorAreaOptions): void {
  options.updateEditorTabBarLayout();
  renderEditorTabs(options);

  const nextState = renderEditorSurfaceImpl(
    {
      editorTabs: options.editorTabs,
      activeEditorTabId: options.activeEditorTabId,
      activePairedEditorSubtab: options.activePairedEditorSubtab,
      lastRenderedPromptEditorStateKey: options.lastRenderedPromptEditorStateKey,
    },
    {
      workbenchElement: options.workbenchElement,
      browserToolbarElement: options.browserToolbarElement,
      browserToolbarControlsElement: options.browserToolbarControlsElement,
      browserAddressFormElement: options.browserAddressFormElement,
      browserViewElement: options.browserViewElement,
      chatHistoryViewElement: options.chatHistoryViewElement,
      promptEditorViewElement: options.promptEditorViewElement,
      browserElement: options.browserElement,
    },
    {
      getPairedChatSelection: () => options.pairedSelection,
      getPairedChatEditorTab: options.getPairedChatEditorTab,
      createChatHistoryTabContent: options.createChatHistoryTabContent,
      createPromptEditorContent: options.createPromptEditorContent,
      renderPromptMenuPortal: options.renderPromptMenuPortal,
    },
  );

  options.setActivePairedEditorSubtab(nextState.activePairedEditorSubtab);
  options.setLastRenderedPromptEditorStateKey(nextState.lastRenderedPromptEditorStateKey);
}
