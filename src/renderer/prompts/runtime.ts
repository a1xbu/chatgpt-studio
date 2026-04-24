import type { PromptDirectorySnapshot, PromptRecord } from '../../shared/contracts';
import type { PromptEditorTab } from '../editor/types';

export function syncPromptsSnapshot(options: {
  snapshot: PromptDirectorySnapshot;
  setPromptDirectoryPath: (value: string) => void;
  setPrompts: (value: PromptRecord[]) => void;
  promptContentCache: Map<string, string>;
  normalizeEditorTabsState: () => void;
}): void {
  options.setPromptDirectoryPath(options.snapshot.directoryPath);
  options.setPrompts(options.snapshot.prompts);
  const validIds = new Set(options.snapshot.prompts.map((entry) => entry.id));
  for (const cachedId of Array.from(options.promptContentCache.keys())) {
    if (!validIds.has(cachedId)) {
      options.promptContentCache.delete(cachedId);
    }
  }
  options.normalizeEditorTabsState();
}

export async function refreshPrompts(options: {
  shouldRender?: boolean;
  listPrompts: () => Promise<PromptDirectorySnapshot>;
  readPrompt: (promptId: string) => Promise<{ content: string } | null>;
  promptContentCache: Map<string, string>;
  setPromptDirectoryPath: (value: string) => void;
  setPrompts: (value: PromptRecord[]) => void;
  normalizeEditorTabsState: () => void;
  render: () => void;
}): Promise<void> {
  const snapshot = await options.listPrompts();
  syncPromptsSnapshot({
    snapshot,
    setPromptDirectoryPath: options.setPromptDirectoryPath,
    setPrompts: options.setPrompts,
    promptContentCache: options.promptContentCache,
    normalizeEditorTabsState: options.normalizeEditorTabsState,
  });

  void Promise.all(snapshot.prompts.map(async (prompt) => {
    if (options.promptContentCache.has(prompt.id)) {
      return;
    }
    const payload = await options.readPrompt(prompt.id);
    if (payload) {
      options.promptContentCache.set(prompt.id, payload.content);
    }
  })).catch(() => undefined);

  if (options.shouldRender ?? true) {
    options.render();
  }
}

export function enterPromptEditMode(
  tab: PromptEditorTab,
  renderEditorArea: () => void,
): void {
  if (tab.status !== 'ready') {
    return;
  }

  tab.isEditing = true;
  tab.draftContent = tab.content;
  tab.isDirty = false;
  tab.saveState = 'idle';
  tab.saveMessage = null;
  renderEditorArea();
}

export function cancelPromptEditing(
  tab: PromptEditorTab,
  renderEditorArea: () => void,
): void {
  if (tab.status !== 'ready') {
    return;
  }

  tab.isEditing = false;
  tab.draftContent = tab.content;
  tab.isDirty = false;
  tab.saveState = 'idle';
  tab.saveMessage = 'Preview';
  renderEditorArea();
}
