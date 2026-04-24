import type { PromptRecord } from '../../shared/contracts';
import type { PromptEditorTab } from '../editor/types';

export type PromptControllerDependencies = {
  readPrompt: (promptId: string) => Promise<{ prompt: PromptRecord; content: string } | null>;
  writePrompt: (promptId: string, content: string) => Promise<PromptRecord>;
  promptContentCache: Map<string, string>;
  renderEditorArea: () => void;
  renderEditorTabs: () => void;
  renderPromptSidebarPanel: () => void;
  refreshPromptEditorStatus: () => void;
  refreshPrompts: (shouldRender?: boolean) => Promise<void>;
  formatTreeTimestamp: (value: string | null | undefined) => string;
  findPromptEditorTab: (promptId: string) => PromptEditorTab | null;
  getPromptEditorTabId: (promptId: string) => string;
  trimPromptEditorTabs: () => void;
  getPrompts: () => PromptRecord[];
  getEditorTabs: () => PromptEditorTab[];
  setEditorTabs: (tabs: PromptEditorTab[]) => void;
  getActiveEditorTabId: () => string;
  setActiveEditorTabId: (tabId: string) => void;
};

export async function loadPromptIntoTab(
  tab: PromptEditorTab,
  deps: PromptControllerDependencies,
  forceReload = false,
): Promise<void> {
  if (!forceReload && tab.status === 'ready') {
    deps.renderEditorArea();
    return;
  }

  if (tab.inFlightRequest) {
    await tab.inFlightRequest;
    return;
  }

  tab.requestToken += 1;
  const requestToken = tab.requestToken;
  tab.status = 'loading';
  tab.message = null;
  deps.renderEditorArea();

  const loadPromise = (async () => {
    try {
      const payload = await deps.readPrompt(tab.promptId);
      if (tab.requestToken !== requestToken) {
        return;
      }

      if (!payload) {
        tab.status = 'error';
        tab.message = 'Prompt was not found.';
        deps.renderEditorArea();
        return;
      }

      tab.promptRecord = payload.prompt;
      tab.title = payload.prompt.title;
      tab.promptPath = payload.prompt.fullPath;
      tab.content = payload.content;
      tab.draftContent = payload.content;
      deps.promptContentCache.set(tab.promptId, payload.content);
      tab.isDirty = false;
      tab.isEditing = false;
      tab.status = 'ready';
      tab.saveState = 'idle';
      tab.saveMessage = 'Preview';
      deps.renderEditorArea();
    } catch (error) {
      if (tab.requestToken !== requestToken) {
        return;
      }

      tab.status = 'error';
      tab.message = error instanceof Error ? error.message : String(error);
      deps.renderEditorArea();
    } finally {
      tab.inFlightRequest = null;
    }
  })();

  tab.inFlightRequest = loadPromise;
  await loadPromise;
}

export async function savePromptTab(
  tab: PromptEditorTab,
  deps: PromptControllerDependencies,
): Promise<void> {
  if (tab.status !== 'ready' || !tab.isEditing || !tab.isDirty) {
    deps.refreshPromptEditorStatus();
    return;
  }

  tab.saveState = 'saving';
  tab.saveMessage = null;
  deps.refreshPromptEditorStatus();

  try {
    const updatedPrompt = await deps.writePrompt(tab.promptId, tab.draftContent);
    tab.promptRecord = updatedPrompt;
    tab.title = updatedPrompt.title;
    tab.promptPath = updatedPrompt.fullPath;
    tab.content = tab.draftContent;
    deps.promptContentCache.set(tab.promptId, tab.content);
    tab.isDirty = false;
    tab.isEditing = false;
    tab.saveState = 'saved';
    tab.saveMessage = `Saved ${deps.formatTreeTimestamp(updatedPrompt.updatedAt)}`;
    await deps.refreshPrompts(false);
    deps.renderPromptSidebarPanel();
    deps.renderEditorTabs();
    deps.renderEditorArea();
  } catch (error) {
    tab.saveState = 'error';
    tab.saveMessage = error instanceof Error ? error.message : String(error);
    deps.refreshPromptEditorStatus();
  }
}

export async function openPromptTab(
  promptId: string,
  deps: PromptControllerDependencies,
): Promise<void> {
  const existingTab = deps.findPromptEditorTab(promptId);
  if (existingTab) {
    deps.setActiveEditorTabId(existingTab.id);
    deps.renderEditorArea();
    if (existingTab.status !== 'ready') {
      await loadPromptIntoTab(existingTab, deps, false);
    }
    return;
  }

  const promptRecord = deps.getPrompts().find((entry) => entry.id === promptId) ?? null;
  const nextTab: PromptEditorTab = {
    id: deps.getPromptEditorTabId(promptId),
    kind: 'prompt',
    promptId,
    title: promptRecord?.title ?? 'Prompt',
    promptPath: promptRecord?.fullPath ?? '',
    promptRecord,
    content: '',
    draftContent: '',
    status: 'loading',
    message: null,
    isDirty: false,
    isEditing: false,
    saveState: 'idle',
    saveMessage: null,
    requestToken: 0,
    inFlightRequest: null,
  };

  deps.setEditorTabs([...deps.getEditorTabs(), nextTab]);
  deps.trimPromptEditorTabs();
  deps.setActiveEditorTabId(nextTab.id);
  deps.renderEditorArea();
  await loadPromptIntoTab(nextTab, deps, false);
}
