import type { PromptRecord } from '../../shared/contracts';
import type { PromptEditorTab } from '../editor/types';
import type { PromptNameDialogState } from '../sidebar/types';

export function openPromptNameDialog(options: {
  mode: 'create' | 'rename';
  dialogOptions: {
    promptId?: string | null;
    initialValue?: string;
    title: string;
    confirmLabel: string;
  };
  setPromptNameDialogState: (state: PromptNameDialogState | null) => void;
  renderOverlayDialog: () => void;
}): void {
  options.setPromptNameDialogState({
    mode: options.mode,
    promptId: options.dialogOptions.promptId ?? null,
    title: options.dialogOptions.title,
    initialValue: options.dialogOptions.initialValue ?? '',
    confirmLabel: options.dialogOptions.confirmLabel,
    errorMessage: null,
  });
  options.renderOverlayDialog();
}

export function closePromptNameDialog(options: {
  setPromptNameDialogState: (state: PromptNameDialogState | null) => void;
  renderOverlayDialog: () => void;
}): void {
  options.setPromptNameDialogState(null);
  options.renderOverlayDialog();
}

export async function submitPromptNameDialog(rawValue: string, options: {
  promptNameDialogState: PromptNameDialogState | null;
  setPromptNameDialogState: (state: PromptNameDialogState | null) => void;
  createPrompt: (name: string) => Promise<PromptRecord>;
  renamePrompt: (promptId: string, name: string) => Promise<PromptRecord>;
  refreshPrompts: () => Promise<void>;
  openPromptTab: (promptId: string) => Promise<void>;
  promptContentCache: Map<string, string>;
  findPromptEditorTab: (promptId: string) => PromptEditorTab | null;
  getPromptEditorTabId: (promptId: string) => string;
  activeEditorTabId: string;
  setActiveEditorTabId: (tabId: string) => void;
  renderOverlayDialog: () => void;
}): Promise<void> {
  const state = options.promptNameDialogState;
  if (!state) {
    return;
  }

  const normalizedValue = rawValue.trim();
  if (!normalizedValue) {
    options.setPromptNameDialogState({ ...state, initialValue: rawValue, errorMessage: 'File name cannot be empty.' });
    options.renderOverlayDialog();
    return;
  }

  const nextName = normalizedValue.toLowerCase().endsWith('.md') ? normalizedValue : `${normalizedValue}.md`;

  try {
    if (state.mode === 'create') {
      const prompt = await options.createPrompt(nextName);
      options.setPromptNameDialogState(null);
      await options.refreshPrompts();
      await options.openPromptTab(prompt.id);
      return;
    }

    const promptId = state.promptId ?? '';
    if (!promptId) {
      options.setPromptNameDialogState(null);
      options.renderOverlayDialog();
      return;
    }

    const renamedPrompt = await options.renamePrompt(promptId, nextName);
    const cachedContent = options.promptContentCache.get(promptId);
    if (cachedContent != null) {
      options.promptContentCache.delete(promptId);
      options.promptContentCache.set(renamedPrompt.id, cachedContent);
    }

    const openTab = options.findPromptEditorTab(promptId);
    if (openTab) {
      openTab.promptId = renamedPrompt.id;
      openTab.id = options.getPromptEditorTabId(renamedPrompt.id);
      openTab.title = renamedPrompt.title;
      openTab.promptPath = renamedPrompt.fullPath;
      openTab.promptRecord = renamedPrompt;
      if (options.activeEditorTabId === options.getPromptEditorTabId(promptId)) {
        options.setActiveEditorTabId(openTab.id);
      }
    }

    options.setPromptNameDialogState(null);
    await options.refreshPrompts();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.setPromptNameDialogState({ ...state, initialValue: rawValue, errorMessage: message });
    options.renderOverlayDialog();
  }
}
