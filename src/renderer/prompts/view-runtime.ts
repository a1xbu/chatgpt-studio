import type { PromptDirectorySnapshot, PromptFilePayload } from '../desktop-api';
import type { PromptEditorTab } from '../editor/types';
import { renderPromptViewPanelMarkup } from './sidebar';
import { renderPromptMenuPortal as renderPromptMenuPortalImpl, renderPromptItemMenu as renderPromptItemMenuImpl, setActivePromptMenu as setActivePromptMenuImpl } from './menu';
import { refreshPrompts as refreshPromptsImpl, syncPromptsSnapshot as syncPromptsSnapshotImpl } from './runtime';
import type { PromptMenuState } from '../sidebar/types';
import { clearManagedMenuCloseTimer, closeManagedMenu, scheduleManagedMenuClose, type ManagedMenuRuntimeOptions } from '../ui/menu-runtime';
import type { PromptRecord } from '../../shared/contracts';
import type { RendererClearTimeout, RendererSetTimeout } from '../app/timers';

export type PromptMenuRuntimeState = {
  activePromptMenu: PromptMenuState | null;
  activePromptMenuCloseTimer: number | null;
};

export type PromptMenuRuntimeStateSetter = (nextState: PromptMenuRuntimeState) => void;

export function getPromptMenuKey(state: PromptMenuState | null): string {
  return state ? state.promptId : '';
}

export function createPromptMenuRuntimeOptions(options: {
  getState: () => PromptMenuRuntimeState;
  setState: PromptMenuRuntimeStateSetter;
  render: () => void;
  setTimeoutImpl: RendererSetTimeout;
  clearTimeoutImpl: RendererClearTimeout;
}): ManagedMenuRuntimeOptions<PromptMenuState> {
  return {
    getActiveMenu: () => options.getState().activePromptMenu,
    setActiveMenu: (value) => {
      const state = options.getState();
      options.setState({ ...state, activePromptMenu: value });
    },
    getCloseTimer: () => options.getState().activePromptMenuCloseTimer,
    setCloseTimer: (value) => {
      const state = options.getState();
      options.setState({ ...state, activePromptMenuCloseTimer: value });
    },
    clearTimeout: (timerId) => {
      options.clearTimeoutImpl(timerId);
    },
    setTimeout: (callback, delayMs) => options.setTimeoutImpl(callback, delayMs),
    render: options.render,
    getMenuKey: getPromptMenuKey,
  };
}

export function clearActivePromptMenuCloseTimer(options: ManagedMenuRuntimeOptions<PromptMenuState>): void {
  clearManagedMenuCloseTimer(options);
}

export function closeActivePromptMenu(options: ManagedMenuRuntimeOptions<PromptMenuState>, shouldRender = true): void {
  closeManagedMenu(options, shouldRender);
}

export function scheduleActivePromptMenuClose(options: ManagedMenuRuntimeOptions<PromptMenuState>, delayMs = 5000): void {
  scheduleManagedMenuClose(options, delayMs);
}

export function syncPromptsSnapshot(options: {
  snapshot: PromptDirectorySnapshot;
  setPromptDirectoryPath: (value: string) => void;
  setPrompts: (value: PromptRecord[]) => void;
  promptContentCache: Map<string, string>;
  normalizeEditorTabsState: () => void;
}): void {
  syncPromptsSnapshotImpl(options);
}

export async function refreshPrompts(options: {
  shouldRender?: boolean;
  listPrompts: () => Promise<PromptDirectorySnapshot>;
  readPrompt: (promptId: string) => Promise<PromptFilePayload | null>;
  promptContentCache: Map<string, string>;
  setPromptDirectoryPath: (value: string) => void;
  setPrompts: (value: PromptRecord[]) => void;
  normalizeEditorTabsState: () => void;
  render: () => void;
}): Promise<void> {
  await refreshPromptsImpl({
    shouldRender: options.shouldRender,
    listPrompts: options.listPrompts,
    readPrompt: options.readPrompt,
    promptContentCache: options.promptContentCache,
    setPromptDirectoryPath: options.setPromptDirectoryPath,
    setPrompts: options.setPrompts,
    normalizeEditorTabsState: options.normalizeEditorTabsState,
    render: options.render,
  });
}

export function renderPromptItemMenu(prompt: PromptRecord, escapeHtml: (value: string | null | undefined) => string): string {
  return renderPromptItemMenuImpl(prompt, escapeHtml);
}

export function renderPromptMenuPortal(options: {
  activePromptMenu: PromptMenuState | null;
  prompts: PromptRecord[];
  promptViewPanelElement: HTMLElement | null;
  documentLike: Document;
  bodyElement: HTMLElement;
  windowLike: Window;
  clearActivePromptMenuCloseTimer: () => void;
  scheduleActivePromptMenuClose: () => void;
  escapeHtml: (value: string | null | undefined) => string;
}): void {
  renderPromptMenuPortalImpl({
    activePromptMenu: options.activePromptMenu,
    prompts: options.prompts,
    promptViewPanelElement: options.promptViewPanelElement,
    documentLike: options.documentLike,
    bodyElement: options.bodyElement,
    windowLike: options.windowLike,
    clearActivePromptMenuCloseTimer: options.clearActivePromptMenuCloseTimer,
    scheduleActivePromptMenuClose: options.scheduleActivePromptMenuClose,
    renderPromptItemMenu: (prompt) => renderPromptItemMenu(prompt, options.escapeHtml),
  });
}

export function setActivePromptMenu(options: {
  promptId: string;
  runtimeOptions: ManagedMenuRuntimeOptions<PromptMenuState>;
  shouldToggle?: boolean;
}): void {
  setActivePromptMenuImpl(options.promptId, options.runtimeOptions, options.shouldToggle);
}

export function renderPromptViewPanel(options: {
  promptDirectoryPath: string;
  prompts: PromptRecord[];
  activePromptMenuId: string | null;
  activeEditorTabId: string;
  escapeHtml: (value: string | null | undefined) => string;
  renderOpenFolderIcon: () => string;
  renderFileTreeFileIcon: () => string;
  renderSharedFileTreeItem: (model: any) => string;
  renderSharedFileTreeActionButton: (model: any) => string;
  renderMoreActionsIcon: () => string;
  getPromptEditorTabId: (promptId: string) => string;
}): string {
  return renderPromptViewPanelMarkup(
    {
      promptDirectoryPath: options.promptDirectoryPath,
      prompts: options.prompts,
      activePromptMenuId: options.activePromptMenuId,
      activeEditorTabId: options.activeEditorTabId,
    },
    {
      escapeHtml: options.escapeHtml,
      renderOpenFolderIcon: options.renderOpenFolderIcon,
      renderFileTreeFileIcon: options.renderFileTreeFileIcon,
      renderSharedFileTreeItem: options.renderSharedFileTreeItem,
      renderSharedFileTreeActionButton: options.renderSharedFileTreeActionButton,
      renderMoreActionsIcon: options.renderMoreActionsIcon,
      getPromptEditorTabId: options.getPromptEditorTabId,
    },
  );
}
