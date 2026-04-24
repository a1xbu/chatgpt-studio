import type { PromptEditorTab } from '../editor/types';
import {
  loadPromptIntoTab as loadPromptIntoTabImpl,
  openPromptTab as openPromptTabImpl,
  savePromptTab as savePromptTabImpl,
  type PromptControllerDependencies,
} from './controller';

export type PromptRuntimeController = {
  loadPromptIntoTab: (tab: PromptEditorTab, forceReload?: boolean) => Promise<void>;
  savePromptTab: (tab: PromptEditorTab) => Promise<void>;
  openPromptTab: (promptId: string) => Promise<void>;
};

export function createPromptRuntimeController(deps: PromptControllerDependencies): PromptRuntimeController {
  return {
    loadPromptIntoTab: (tab, forceReload = false) => loadPromptIntoTabImpl(tab, deps, forceReload),
    savePromptTab: (tab) => savePromptTabImpl(tab, deps),
    openPromptTab: (promptId) => openPromptTabImpl(promptId, deps),
  };
}
