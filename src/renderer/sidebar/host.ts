import type { RendererContext } from '../app/context';
import { createSidebarRegionRuntime, type CreateSidebarRegionRuntimeOptions, type SidebarRegionRuntime } from './region-runtime';
import type { SidebarSelection, SidebarTabId, TreeMenuState } from './types';
import { createRendererTreeMenuRuntime } from './tree-menu-runtime';

export type RendererSidebarBootstrapUiState = {
  applySidebarWidth: (width: number) => void;
  applySidebarTabState: () => void;
  installSidebarResizer: () => void;
  installSidebarDetailsResizer: () => void;
  installNewFilesPanelResizer: () => void;
  applyNewFilesPanelHeight: (height: number) => void;
};

export type RendererSidebarBindingsState = {
  getActiveSidebarTabId: () => SidebarTabId;
  setActiveSidebarTabId: (nextTab: SidebarTabId) => void;
  getActiveTreeMenu: () => TreeMenuState | null;
  setActiveTreeMenu: (state: TreeMenuState | null) => void;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  isActiveTreeMenuOpen: () => boolean;
  closeActiveTreeMenu: () => void;
};

export type RendererSidebarBindingsActions = {
  persistActiveSidebarTabId: (nextTab: SidebarTabId) => void;
  getLocalFileTreeKey: (projectId: string, relativePath?: string) => string;
  clearActiveTreeMenuCloseTimer: () => void;
  scheduleActiveTreeMenuClose: () => void;
  persistExpandedProjectIds: () => void;
};

export type RendererSidebarBootstrapSlice = {
  uiState: RendererSidebarBootstrapUiState;
};

export type RendererSidebarBindingsSlice = {
  state: RendererSidebarBindingsState;
  actions: RendererSidebarBindingsActions;
};

export type RendererSidebarHost = Pick<
  SidebarRegionRuntime,
  | 'renderSharedFileTreeItem'
  | 'renderSharedFileTreeActionButton'
  | 'getTreeMenuKey'
  | 'getLocalFileTreeKey'
  | 'getLocalFileTreeDepth'
  | 'getLocalFileTreeChildren'
  | 'persistExpandedProjectIds'
  | 'setSelectedSidebarItem'
  | 'applySidebarWidth'
  | 'applyNewFilesPanelHeight'
  | 'ensureNewFilesPanelHeight'
  | 'applySidebarDetailsState'
  | 'applySidebarTabState'
  | 'renderSidebarDetails'
  | 'ensureExpandedProjects'
  | 'installSidebarResizer'
  | 'installSidebarDetailsResizer'
  | 'installNewFilesPanelResizer'
> & {
  getActiveSidebarTabId: () => SidebarTabId;
  setActiveSidebarTabId: (nextTab: SidebarTabId) => void;
  persistActiveSidebarTabId: (nextTab: SidebarTabId) => void;
  getActiveTreeMenu: () => TreeMenuState | null;
  setActiveTreeMenu: (state: TreeMenuState | null) => void;
  isActiveTreeMenuOpen: () => boolean;
  clearActiveTreeMenuCloseTimer: () => void;
  closeActiveTreeMenu: (shouldRender?: boolean) => void;
  scheduleActiveTreeMenuClose: (delayMs?: number) => void;
  createBootstrapSlice: () => RendererSidebarBootstrapSlice;
  createBindingsSlice: () => RendererSidebarBindingsSlice;
};

export type CreateRendererSidebarHostOptions = {
  sidebarUiRuntime: CreateSidebarRegionRuntimeOptions;
  getContext: () => RendererContext;
};

export function createRendererSidebarHost(
  options: CreateRendererSidebarHostOptions,
): RendererSidebarHost {
  const sidebarUiRuntime = createSidebarRegionRuntime(options.sidebarUiRuntime);
  const treeMenuRuntime = createRendererTreeMenuRuntime({
    getContext: options.getContext,
    getTreeMenuKey: sidebarUiRuntime.getTreeMenuKey,
  });

  const getActiveSidebarTabId = (): SidebarTabId => options.sidebarUiRuntime.workspaceState.activeSidebarTabId;
  const setActiveSidebarTabId = (nextTab: SidebarTabId): void => {
    options.sidebarUiRuntime.workspaceState.activeSidebarTabId = nextTab;
  };
  const persistActiveSidebarTabId = (nextTab: SidebarTabId): void => {
    const storageKey = options.sidebarUiRuntime.storageKeys.sidebarActiveTab;
    if (!storageKey) {
      return;
    }

    options.sidebarUiRuntime.storage.setItem(storageKey, nextTab);
  };

  const getActiveTreeMenu = (): TreeMenuState | null => options.getContext().state.treeMenu.getActiveMenu();
  const setActiveTreeMenu = (state: TreeMenuState | null): void => {
    options.getContext().state.treeMenu.setActiveMenu(state);
  };
  const isActiveTreeMenuOpen = (): boolean => Boolean(getActiveTreeMenu());

  const clearActiveTreeMenuCloseTimer = (): void => {
    treeMenuRuntime.clearCloseTimer();
  };
  const closeActiveTreeMenu = (shouldRender?: boolean): void => {
    treeMenuRuntime.close(shouldRender);
  };
  const scheduleActiveTreeMenuClose = (delayMs?: number): void => {
    treeMenuRuntime.scheduleClose(delayMs);
  };

  const createBootstrapSlice = (): RendererSidebarBootstrapSlice => ({
    uiState: {
      applySidebarWidth: sidebarUiRuntime.applySidebarWidth,
      applySidebarTabState: sidebarUiRuntime.applySidebarTabState,
      installSidebarResizer: sidebarUiRuntime.installSidebarResizer,
      installSidebarDetailsResizer: sidebarUiRuntime.installSidebarDetailsResizer,
      installNewFilesPanelResizer: sidebarUiRuntime.installNewFilesPanelResizer,
      applyNewFilesPanelHeight: sidebarUiRuntime.applyNewFilesPanelHeight,
    },
  });

  const createBindingsSlice = (): RendererSidebarBindingsSlice => ({
    state: {
      getActiveSidebarTabId,
      setActiveSidebarTabId,
      getActiveTreeMenu,
      setActiveTreeMenu,
      setSelectedSidebarItem: sidebarUiRuntime.setSelectedSidebarItem,
      isActiveTreeMenuOpen,
      closeActiveTreeMenu: () => {
        closeActiveTreeMenu(true);
      },
    },
    actions: {
      persistActiveSidebarTabId,
      getLocalFileTreeKey: sidebarUiRuntime.getLocalFileTreeKey,
      clearActiveTreeMenuCloseTimer,
      scheduleActiveTreeMenuClose: () => {
        scheduleActiveTreeMenuClose();
      },
      persistExpandedProjectIds: sidebarUiRuntime.persistExpandedProjectIds,
    },
  });

  return {
    renderSharedFileTreeItem: sidebarUiRuntime.renderSharedFileTreeItem,
    renderSharedFileTreeActionButton: sidebarUiRuntime.renderSharedFileTreeActionButton,
    getTreeMenuKey: sidebarUiRuntime.getTreeMenuKey,
    getLocalFileTreeKey: sidebarUiRuntime.getLocalFileTreeKey,
    getLocalFileTreeDepth: sidebarUiRuntime.getLocalFileTreeDepth,
    getLocalFileTreeChildren: sidebarUiRuntime.getLocalFileTreeChildren,
    persistExpandedProjectIds: sidebarUiRuntime.persistExpandedProjectIds,
    setSelectedSidebarItem: sidebarUiRuntime.setSelectedSidebarItem,
    applySidebarWidth: sidebarUiRuntime.applySidebarWidth,
    applyNewFilesPanelHeight: sidebarUiRuntime.applyNewFilesPanelHeight,
    ensureNewFilesPanelHeight: sidebarUiRuntime.ensureNewFilesPanelHeight,
    applySidebarDetailsState: sidebarUiRuntime.applySidebarDetailsState,
    applySidebarTabState: sidebarUiRuntime.applySidebarTabState,
    renderSidebarDetails: sidebarUiRuntime.renderSidebarDetails,
    ensureExpandedProjects: sidebarUiRuntime.ensureExpandedProjects,
    installSidebarResizer: sidebarUiRuntime.installSidebarResizer,
    installSidebarDetailsResizer: sidebarUiRuntime.installSidebarDetailsResizer,
    installNewFilesPanelResizer: sidebarUiRuntime.installNewFilesPanelResizer,
    getActiveSidebarTabId,
    setActiveSidebarTabId,
    persistActiveSidebarTabId,
    getActiveTreeMenu,
    setActiveTreeMenu,
    isActiveTreeMenuOpen,
    clearActiveTreeMenuCloseTimer,
    closeActiveTreeMenu,
    scheduleActiveTreeMenuClose,
    createBootstrapSlice,
    createBindingsSlice,
  };
}
