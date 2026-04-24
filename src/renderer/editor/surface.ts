import type { BrowserEditorTab, ChatEditorTab, EditorTabState, PromptEditorTab } from './types';

function getTabContentKey(tabId: string): string {
  return `chat:${tabId}`;
}

function getMountedChatHistoryContents(host: HTMLElement): HTMLElement[] {
  const collection = (host as HTMLElement & { children?: ArrayLike<unknown> | null }).children;
  if (collection && typeof collection.length === 'number') {
    return Array.from(collection).filter((child): child is HTMLElement => child instanceof HTMLElement);
  }

  const firstElementChild = (host as HTMLElement & { firstElementChild?: unknown }).firstElementChild;
  return firstElementChild instanceof HTMLElement ? [firstElementChild] : [];
}

function getChatHistoryMessagesElement(content: HTMLElement | null): HTMLElement | null {
  if (!(content instanceof HTMLElement)) {
    return null;
  }

  const messages = content.querySelector('.chat-history-messages');
  return messages instanceof HTMLElement ? messages : null;
}

function syncMountedChatHistoryContent(host: HTMLElement, content: HTMLElement | null, contentKey: string | null, validContentKeys: ReadonlySet<string>): void {
  const mountedContents = getMountedChatHistoryContents(host);
  for (const element of mountedContents) {
    const elementKey = element.dataset.chatHistoryContentKey ?? '';
    if (elementKey && validContentKeys.has(elementKey)) {
      continue;
    }
    element.remove();
  }

  if (!content || !contentKey) {
    for (const element of getMountedChatHistoryContents(host)) {
      element.hidden = true;
      if (typeof element.setAttribute === 'function') {
        element.setAttribute('aria-hidden', 'true');
      }
      element.style.display = 'none';
    }
    delete host.dataset.activeChatHistoryContentKey;
    return;
  }

  if (content.parentElement !== host) {
    host.append(content);
  }

  for (const element of getMountedChatHistoryContents(host)) {
    const isActive = element === content;
    element.hidden = !isActive;
    if (typeof element.setAttribute === 'function') {
      element.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    }
    element.style.display = isActive ? '' : 'none';
  }

  host.dataset.activeChatHistoryContentKey = contentKey;
}

function scrollChatHistoryToLatest(host: HTMLElement, activeLocalTab: ChatEditorTab): void {
  requestAnimationFrame(() => {
    const activeContent = getMountedChatHistoryContents(host).find((element) => !element.hidden) ?? null;
    const activeContentKey = getTabContentKey(activeLocalTab.id);
    if (!(activeContent instanceof HTMLElement) || activeContent.dataset.chatHistoryContentKey !== activeContentKey) {
      return;
    }

    const messages = getChatHistoryMessagesElement(activeContent);
    if (!messages) {
      return;
    }

    messages.scrollTop = messages.scrollHeight;
  });
}

export type EditorSurfaceState = {
  editorTabs: EditorTabState[];
  activeEditorTabId: string;
  activePairedEditorSubtab: 'browser' | 'local';
  lastRenderedPromptEditorStateKey: string;
};

export type EditorSurfaceElements = {
  workbenchElement: HTMLElement | null;
  browserToolbarElement: HTMLElement | null;
  browserToolbarControlsElement: HTMLElement | null;
  browserAddressFormElement: HTMLElement | null;
  browserViewElement: HTMLElement | null;
  chatHistoryViewElement: HTMLElement | null;
  promptEditorViewElement: HTMLElement | null;
  browserElement: HTMLElement | null;
};

export type EditorSurfaceHelpers = {
  getPairedChatSelection: () => unknown | null;
  getPairedChatEditorTab: () => ChatEditorTab | null;
  createChatHistoryTabContent: (tab: ChatEditorTab) => HTMLElement;
  createPromptEditorContent: (tab: PromptEditorTab) => HTMLElement;
  renderPromptMenuPortal: () => void;
};

export function renderEditorSurface(
  state: EditorSurfaceState,
  elements: EditorSurfaceElements,
  helpers: EditorSurfaceHelpers,
): Pick<EditorSurfaceState, 'activePairedEditorSubtab' | 'lastRenderedPromptEditorStateKey'> {
  const activeTab = state.editorTabs.find((tab) => tab.id === state.activeEditorTabId) ?? state.editorTabs[0];
  const pairedSelection = helpers.getPairedChatSelection();
  const pairedChatTab = helpers.getPairedChatEditorTab();

  let activePairedEditorSubtab = state.activePairedEditorSubtab;
  let lastRenderedPromptEditorStateKey = state.lastRenderedPromptEditorStateKey;

  if (state.activeEditorTabId === 'browser' && activePairedEditorSubtab === 'local' && !pairedChatTab) {
    activePairedEditorSubtab = 'browser';
  }

  const showPairedLocalView = state.activeEditorTabId === 'browser'
    && Boolean(pairedSelection)
    && activePairedEditorSubtab === 'local'
    && Boolean(pairedChatTab);
  const showBrowserView = state.activeEditorTabId === 'browser' && !showPairedLocalView;
  const activeLocalTab = showPairedLocalView
    ? pairedChatTab
    : activeTab && activeTab.kind === 'chat'
      ? activeTab
      : null;
  const activePromptTab = activeTab && activeTab.kind === 'prompt' ? activeTab : null;
  const showPromptView = Boolean(activePromptTab) && !showBrowserView && !activeLocalTab;
  const showLocalMode = (Boolean(activeLocalTab) || showPromptView) && !showBrowserView;

  elements.workbenchElement?.classList.toggle('workbench--local-tab', showLocalMode);
  elements.browserToolbarElement?.classList.toggle('workspace__toolbar--hidden', !showBrowserView);
  elements.browserToolbarControlsElement?.classList.toggle('browser-toolbar-controls--hidden', !showBrowserView);
  elements.browserAddressFormElement?.classList.toggle('address-bar--hidden', !showBrowserView);

  elements.browserViewElement?.classList.toggle('editor-view--active', showBrowserView);
  elements.chatHistoryViewElement?.classList.toggle('editor-view--active', Boolean(activeLocalTab));
  elements.promptEditorViewElement?.classList.toggle('editor-view--active', showPromptView);
  elements.browserViewElement?.toggleAttribute('hidden', !showBrowserView);
  elements.chatHistoryViewElement?.toggleAttribute('hidden', !activeLocalTab);
  elements.promptEditorViewElement?.toggleAttribute('hidden', !showPromptView);

  if (elements.browserElement) {
    elements.browserElement.style.visibility = showBrowserView ? 'visible' : 'hidden';
    elements.browserElement.style.pointerEvents = showBrowserView ? 'auto' : 'none';
  }

  if (elements.chatHistoryViewElement) {
    const validChatContentKeys = new Set(
      state.editorTabs
        .filter((tab): tab is ChatEditorTab => tab.kind === 'chat' && tab.renderedContent instanceof HTMLElement)
        .map((tab) => getTabContentKey(tab.id)),
    );

    if (!activeLocalTab) {
      syncMountedChatHistoryContent(elements.chatHistoryViewElement, null, null, validChatContentKeys);
    } else {
      const needsRenderedContent = !activeLocalTab.renderedContent;
      const activeContentKey = getTabContentKey(activeLocalTab.id);
      if (needsRenderedContent) {
        activeLocalTab.renderedContent = helpers.createChatHistoryTabContent(activeLocalTab);
      }

      if (activeLocalTab.renderedContent instanceof HTMLElement) {
        activeLocalTab.renderedContent.dataset.chatHistoryContentKey = activeContentKey;
        validChatContentKeys.add(activeContentKey);
        syncMountedChatHistoryContent(elements.chatHistoryViewElement, activeLocalTab.renderedContent, activeContentKey, validChatContentKeys);
        if (needsRenderedContent) {
          scrollChatHistoryToLatest(elements.chatHistoryViewElement, activeLocalTab);
        }
      } else {
        syncMountedChatHistoryContent(elements.chatHistoryViewElement, null, null, validChatContentKeys);
      }
    }
  }

  if (elements.promptEditorViewElement) {
    if (!activePromptTab) {
      lastRenderedPromptEditorStateKey = '';
      if (elements.promptEditorViewElement.childElementCount) {
        elements.promptEditorViewElement.replaceChildren();
      }
    } else {
      const stateKey = [
        activePromptTab.id,
        activePromptTab.status,
        activePromptTab.isEditing ? 'edit' : 'preview',
        activePromptTab.isDirty ? 'dirty' : 'clean',
        activePromptTab.title,
        activePromptTab.promptPath,
        activePromptTab.isEditing ? activePromptTab.draftContent : activePromptTab.content,
        activePromptTab.saveState,
        activePromptTab.saveMessage ?? '',
        activePromptTab.message ?? '',
      ].join('|');
      if (stateKey !== lastRenderedPromptEditorStateKey) {
        const promptContent = helpers.createPromptEditorContent(activePromptTab);
        elements.promptEditorViewElement.replaceChildren(promptContent);
        lastRenderedPromptEditorStateKey = stateKey;
      }
    }
  }

  helpers.renderPromptMenuPortal();

  return {
    activePairedEditorSubtab,
    lastRenderedPromptEditorStateKey,
  };
}
