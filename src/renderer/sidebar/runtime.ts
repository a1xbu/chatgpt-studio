import type { AppStateSnapshot, ProjectChatRecord } from '../../shared/contracts';
import type { ChatEditorTab, EditorTabState } from '../editor/types';
import type { SidebarSelection, SidebarTabId } from './types';

export function persistExpandedProjectIds(
  storage: Storage,
  storageKey: string,
  expandedProjectIds: Set<string>,
): void {
  storage.setItem(storageKey, JSON.stringify([...expandedProjectIds]));
}

export function persistSidebarSelection(
  storage: Storage,
  storageKey: string,
  selectedSidebarItem: SidebarSelection | null,
): void {
  if (!selectedSidebarItem) {
    storage.removeItem(storageKey);
    return;
  }

  storage.setItem(storageKey, JSON.stringify(selectedSidebarItem));
}

export function setSelectedSidebarItem(
  nextSelection: SidebarSelection | null,
  options: {
    setSidebarSelection: (selection: SidebarSelection | null) => void;
    persistSidebarSelection: (selection: SidebarSelection | null) => void;
  },
): void {
  options.setSidebarSelection(nextSelection);
  options.persistSidebarSelection(nextSelection);
}

export function persistBrowserOpenedSelection(
  storage: Storage,
  storageKey: string,
  browserOpenedSidebarItem: SidebarSelection | null,
): void {
  if (!browserOpenedSidebarItem) {
    storage.removeItem(storageKey);
    return;
  }

  storage.setItem(storageKey, JSON.stringify(browserOpenedSidebarItem));
}

export function persistActiveLocalChatSelection(options: {
  storage: Storage;
  storageKey: string;
  editorTabs: readonly EditorTabState[];
  activeEditorTabId: EditorTabState['id'];
  activePairedEditorSubtab: 'browser' | 'local';
  getPairedChatEditorTab: () => ChatEditorTab | null;
}): void {
  const activeTab = options.editorTabs.find((tab): tab is ChatEditorTab => tab.kind === 'chat' && tab.id === options.activeEditorTabId) ?? null;
  const pairedLocalTab = options.activeEditorTabId === 'browser' && options.activePairedEditorSubtab === 'local'
    ? options.getPairedChatEditorTab()
    : null;
  const persistedTab = activeTab ?? pairedLocalTab;
  if (!persistedTab) {
    options.storage.removeItem(options.storageKey);
    return;
  }

  options.storage.setItem(
    options.storageKey,
    JSON.stringify({ kind: 'chat', projectId: persistedTab.projectId, chatId: persistedTab.chatId }),
  );
}

export function applySidebarWidth(
  width: number,
  documentElement: HTMLElement,
  storage: Storage,
  storageKey: string,
): void {
  documentElement.style.setProperty('--sidebar-width', `${width}px`);
  storage.setItem(storageKey, String(width));
}

export function clampSidebarDetailsHeight(
  height: number,
  sidebarElement: HTMLElement | null,
  minHeight: number,
): number {
  const sidebarHeight = sidebarElement?.clientHeight ?? 720;
  const maxHeight = Math.max(minHeight, sidebarHeight - 160);
  return Math.min(maxHeight, Math.max(minHeight, Math.round(height)));
}

export function applySidebarDetailsHeight(options: {
  height: number;
  documentElement: HTMLElement;
  storage: Storage;
  storageKey: string;
  sidebarElement: HTMLElement | null;
  minHeight: number;
}): void {
  const clampedHeight = clampSidebarDetailsHeight(options.height, options.sidebarElement, options.minHeight);
  options.documentElement.style.setProperty('--sidebar-details-height', `${clampedHeight}px`);
  options.storage.setItem(options.storageKey, String(clampedHeight));
}

export function clampNewFilesPanelHeight(
  height: number,
  sidebarContentElement: HTMLElement | null,
  sidebarElement: HTMLElement | null,
  minHeight: number,
): number {
  const availableHeight = sidebarContentElement?.clientHeight ?? sidebarElement?.clientHeight ?? 720;
  const maxHeight = Math.max(minHeight, Math.round(availableHeight - 140));
  return Math.min(maxHeight, Math.max(minHeight, Math.round(height)));
}

export function applyNewFilesPanelHeight(options: {
  height: number;
  documentElement: HTMLElement;
  storage: Storage;
  storageKey: string;
  sidebarContentElement: HTMLElement | null;
  sidebarElement: HTMLElement | null;
  minHeight: number;
}): void {
  const clampedHeight = clampNewFilesPanelHeight(
    options.height,
    options.sidebarContentElement,
    options.sidebarElement,
    options.minHeight,
  );
  options.documentElement.style.setProperty('--new-files-panel-height', `${clampedHeight}px`);
  options.storage.setItem(options.storageKey, String(clampedHeight));
}

export function ensureNewFilesPanelHeight(options: {
  loadInitialNewFilesHeight: () => number | null;
  applyNewFilesPanelHeight: (height: number) => void;
  sidebarContentElement: HTMLElement | null;
  sidebarElement: HTMLElement | null;
}): void {
  const storedHeight = options.loadInitialNewFilesHeight();
  if (storedHeight != null) {
    options.applyNewFilesPanelHeight(storedHeight);
    return;
  }

  const availableHeight = options.sidebarContentElement?.clientHeight ?? options.sidebarElement?.clientHeight ?? 720;
  options.applyNewFilesPanelHeight(Math.round(availableHeight * 0.5));
}

export function applySidebarDetailsState(options: {
  sidebarContentElement: HTMLElement | null;
  newFilesPanelResizerElement: HTMLElement | null;
  hasNewFiles: boolean;
  isNewFilesCollapsed: boolean;
  storage: Storage;
  storageKey: string;
}): void {
  options.sidebarContentElement?.classList.toggle('sidebar-content--with-new-files', options.hasNewFiles);
  options.sidebarContentElement?.classList.toggle(
    'sidebar-content--new-files-collapsed',
    options.hasNewFiles && options.isNewFilesCollapsed,
  );
  options.newFilesPanelResizerElement?.classList.toggle('new-files-panel-resizer--visible', options.hasNewFiles);
  options.storage.setItem(options.storageKey, String(options.isNewFilesCollapsed));
}

export function applySidebarTabState(options: {
  sidebarActivityElement: HTMLElement | null;
  sidebarPanelExplorerElement: HTMLElement | null;
  sidebarPanelFilesElement: HTMLElement | null;
  sidebarPanelPromptsElement: HTMLElement | null;
  activeSidebarTabId: SidebarTabId;
}): void {
  options.sidebarActivityElement?.querySelectorAll<HTMLElement>('[data-sidebar-tab]').forEach((button) => {
    const isActive = button.dataset.sidebarTab === options.activeSidebarTabId;
    button.classList.toggle('sidebar-activity__button--active', isActive);
  });

  options.sidebarPanelExplorerElement?.classList.toggle('sidebar-panel--active', options.activeSidebarTabId === 'explorer');
  options.sidebarPanelFilesElement?.classList.toggle('sidebar-panel--active', options.activeSidebarTabId === 'files');
  options.sidebarPanelPromptsElement?.classList.toggle('sidebar-panel--active', options.activeSidebarTabId === 'prompts');
}

export function applyDebugPanelHeight(
  height: number,
  documentElement: HTMLElement,
  storage: Storage,
  storageKey: string,
): void {
  documentElement.style.setProperty('--bottom-panel-height', `${height}px`);
  storage.setItem(storageKey, String(height));
}

export function applyDebugPanelState(options: {
  appShellElement: HTMLElement | null;
  toggleBottomPanelButton: HTMLButtonElement | null;
  isDebugPanelCollapsed: boolean;
  storage: Storage;
  storageKey: string;
  scheduleTerminalFit: () => void;
}): void {
  if (!options.appShellElement) {
    return;
  }

  options.appShellElement.classList.toggle('app-shell--debug-collapsed', options.isDebugPanelCollapsed);

  if (options.toggleBottomPanelButton) {
    options.toggleBottomPanelButton.classList.toggle('icon-button--collapsed', options.isDebugPanelCollapsed);
    options.toggleBottomPanelButton.title = options.isDebugPanelCollapsed ? 'Expand bottom panel' : 'Collapse bottom panel';
    options.toggleBottomPanelButton.setAttribute('aria-label', options.toggleBottomPanelButton.title);
  }

  options.storage.setItem(options.storageKey, String(options.isDebugPanelCollapsed));
  options.scheduleTerminalFit();
}

export function resolveSidebarSelection(
  state: AppStateSnapshot,
  selectedSidebarItem: SidebarSelection | null,
  helpers: {
    findSidebarProject: (state: AppStateSnapshot, projectId: string) => unknown;
    findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
  },
): SidebarSelection | null {
  if (selectedSidebarItem) {
    if (selectedSidebarItem.kind === 'project' && helpers.findSidebarProject(state, selectedSidebarItem.projectId)) {
      return selectedSidebarItem;
    }

    if (
      selectedSidebarItem.kind === 'chat'
      && helpers.findSidebarChat(state, selectedSidebarItem.projectId, selectedSidebarItem.chatId)
    ) {
      return selectedSidebarItem;
    }
  }

  return null;
}

export function syncSidebarSelection(options: {
  state: AppStateSnapshot;
  selectedSidebarItem: SidebarSelection | null;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  persistSidebarSelection: (selection: SidebarSelection | null) => void;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => unknown;
  findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
}): void {
  const resolvedSelection = resolveSidebarSelection(options.state, options.selectedSidebarItem, {
    findSidebarProject: options.findSidebarProject,
    findSidebarChat: options.findSidebarChat,
  });
  const currentSerialized = JSON.stringify(options.selectedSidebarItem);
  const nextSerialized = JSON.stringify(resolvedSelection);
  if (currentSerialized === nextSerialized) {
    return;
  }

  options.setSelectedSidebarItem(resolvedSelection);
  options.persistSidebarSelection(resolvedSelection);
}
