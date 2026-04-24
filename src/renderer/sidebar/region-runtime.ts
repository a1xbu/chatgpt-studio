import type { AppStateSnapshot, ProjectChatRecord, SidebarProject } from '../../shared/contracts';
import type { RendererFilesStoreSlice, RendererWorkspaceStoreSlice } from '../app/store';
import type { LocalProjectFileEntry } from '../desktop-api';
import {
  getLocalFileTreeChildren,
  getLocalFileTreeDepth,
  getLocalFileTreeKey,
} from '../files/runtime';
import {
  installNewFilesPanelResizer,
  installSidebarDetailsResizer,
  installSidebarResizer,
} from '../layout/resizers';
import { ensureExpandedProjects as ensureExpandedProjectsImpl } from './queries';
import {
  applyNewFilesPanelHeight,
  applySidebarDetailsHeight,
  applySidebarDetailsState,
  applySidebarTabState,
  applySidebarWidth,
  ensureNewFilesPanelHeight,
  persistExpandedProjectIds,
  persistSidebarSelection,
  setSelectedSidebarItem,
} from './runtime';
import { renderSidebarDetailsHeader, getTreeMenuKey as getTreeMenuKeyImpl } from './tree-menu';
import type { SidebarSelection, TreeMenuState } from './types';
import { renderSidebarDetails } from './view';
import {
  createSharedFileTreeActionButtonRenderer,
  createSharedFileTreeItemRenderer,
  type SharedFileTreeActionButtonModel,
  type SharedFileTreeRowModel,
} from '../tree/shared-tree';

export type SidebarRegionRuntime = {
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
  renderSharedFileTreeActionButton: (model: SharedFileTreeActionButtonModel) => string;
  getTreeMenuKey: (state: TreeMenuState | null) => string;
  getLocalFileTreeKey: (projectId: string, relativePath?: string) => string;
  getLocalFileTreeDepth: (relativePath: string) => number;
  getLocalFileTreeChildren: (projectId: string, relativePath?: string) => LocalProjectFileEntry[];
  persistExpandedProjectIds: () => void;
  setSelectedSidebarItem: (selection: SidebarSelection | null) => void;
  applySidebarWidth: (width: number) => void;
  applySidebarDetailsHeight: (height: number) => void;
  applyNewFilesPanelHeight: (height: number) => void;
  ensureNewFilesPanelHeight: () => void;
  applySidebarDetailsState: (hasNewFiles: boolean) => void;
  applySidebarTabState: () => void;
  renderSidebarDetailsHeader: () => string;
  ensureExpandedProjects: (state: AppStateSnapshot) => void;
  renderSidebarDetails: (state: AppStateSnapshot) => void;
  installSidebarResizer: () => void;
  installSidebarDetailsResizer: () => void;
  installNewFilesPanelResizer: () => void;
};

export type CreateSidebarRegionRuntimeOptions = {
  workspaceState: RendererWorkspaceStoreSlice;
  filesState: RendererFilesStoreSlice;
  storage: Storage;
  storageKeys: {
    projectTreeExpanded: string;
    sidebarSelection: string;
    sidebarActiveTab?: string;
    sidebarWidth: string;
    sidebarDetailsHeight: string;
    newFilesHeight: string;
    newFilesCollapsed: string;
  };
  elements: {
    documentElement: HTMLElement;
    appShellElement: HTMLElement | null;
    sidebarElement: HTMLElement | null;
    sidebarContentElement: HTMLElement | null;
    sidebarActivityElement: HTMLElement | null;
    sidebarPanelExplorerElement: HTMLElement | null;
    sidebarPanelFilesElement: HTMLElement | null;
    sidebarPanelPromptsElement: HTMLElement | null;
    sidebarDetailsElement: HTMLElement | null;
    sidebarResizerElement: HTMLElement | null;
    sidebarDetailsResizerElement: HTMLElement | null;
    newFilesPanelElement: HTMLElement | null;
    newFilesPanelResizerElement: HTMLElement | null;
    dragShieldElement: HTMLElement | null;
  };
  layout: {
    minSidebarWidth: number;
    maxSidebarWidth: number;
    minSidebarDetailsHeight: number;
    minNewFilesPanelHeight: number;
    startDrag: (cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void) => void;
  };
  helpers: {
    loadInitialNewFilesHeight: () => number | null;
    findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
    findSidebarChat: (state: AppStateSnapshot, projectId: string, chatId: string) => ProjectChatRecord | null;
    findKnownProjectUrl: (project: SidebarProject) => string | null;
    normalizeStoredUrl: (value: string | null | undefined) => string | null;
    escapeHtml: (value: string | null | undefined) => string;
    formatTimestamp: (value: string | null | undefined) => string;
    renderChevronIcon: () => string;
    syncSidebarSelection: (state: AppStateSnapshot) => void;
  };
};

export function createSidebarRegionRuntime(options: CreateSidebarRegionRuntimeOptions): SidebarRegionRuntime {
  const renderSharedFileTreeItem = createSharedFileTreeItemRenderer({
    escapeHtml: options.helpers.escapeHtml,
    renderChevronIcon: options.helpers.renderChevronIcon,
  });
  const renderSharedFileTreeActionButton = createSharedFileTreeActionButtonRenderer({
    escapeHtml: options.helpers.escapeHtml,
  });

  const runtime: SidebarRegionRuntime = {
    renderSharedFileTreeItem,
    renderSharedFileTreeActionButton,
    getTreeMenuKey: getTreeMenuKeyImpl,
    getLocalFileTreeKey,
    getLocalFileTreeDepth,
    getLocalFileTreeChildren: (projectId, relativePath = '') => (
      getLocalFileTreeChildren(projectId, relativePath, options.filesState.localFileEntriesByKey)
    ),
    persistExpandedProjectIds: () => {
      persistExpandedProjectIds(
        options.storage,
        options.storageKeys.projectTreeExpanded,
        options.workspaceState.expandedProjectIds,
      );
    },
    setSelectedSidebarItem: (selection) => {
      setSelectedSidebarItem(selection, {
        setSidebarSelection: (nextSelection) => {
          options.workspaceState.selectedSidebarItem = nextSelection;
        },
        persistSidebarSelection: (nextSelection) => {
          persistSidebarSelection(options.storage, options.storageKeys.sidebarSelection, nextSelection);
        },
      });
    },
    applySidebarWidth: (width) => {
      applySidebarWidth(width, options.elements.documentElement, options.storage, options.storageKeys.sidebarWidth);
    },
    applySidebarDetailsHeight: (height) => {
      applySidebarDetailsHeight({
        height,
        documentElement: options.elements.documentElement,
        storage: options.storage,
        storageKey: options.storageKeys.sidebarDetailsHeight,
        sidebarElement: options.elements.sidebarElement,
        minHeight: options.layout.minSidebarDetailsHeight,
      });
    },
    applyNewFilesPanelHeight: (height) => {
      applyNewFilesPanelHeight({
        height,
        documentElement: options.elements.documentElement,
        storage: options.storage,
        storageKey: options.storageKeys.newFilesHeight,
        sidebarContentElement: options.elements.sidebarContentElement,
        sidebarElement: options.elements.sidebarElement,
        minHeight: options.layout.minNewFilesPanelHeight,
      });
    },
    ensureNewFilesPanelHeight: () => {
      ensureNewFilesPanelHeight({
        loadInitialNewFilesHeight: options.helpers.loadInitialNewFilesHeight,
        applyNewFilesPanelHeight: runtime.applyNewFilesPanelHeight,
        sidebarContentElement: options.elements.sidebarContentElement,
        sidebarElement: options.elements.sidebarElement,
      });
    },
    applySidebarDetailsState: (hasNewFiles) => {
      applySidebarDetailsState({
        sidebarContentElement: options.elements.sidebarContentElement,
        newFilesPanelResizerElement: options.elements.newFilesPanelResizerElement,
        hasNewFiles,
        isNewFilesCollapsed: options.workspaceState.isNewFilesCollapsed,
        storage: options.storage,
        storageKey: options.storageKeys.newFilesCollapsed,
      });
    },
    applySidebarTabState: () => {
      applySidebarTabState({
        sidebarActivityElement: options.elements.sidebarActivityElement,
        sidebarPanelExplorerElement: options.elements.sidebarPanelExplorerElement,
        sidebarPanelFilesElement: options.elements.sidebarPanelFilesElement,
        sidebarPanelPromptsElement: options.elements.sidebarPanelPromptsElement,
        activeSidebarTabId: options.workspaceState.activeSidebarTabId,
      });
    },
    renderSidebarDetailsHeader: () => {
      return renderSidebarDetailsHeader({
        isSidebarDetailsCollapsed: options.workspaceState.isSidebarDetailsCollapsed,
        renderChevronIcon: options.helpers.renderChevronIcon,
      });
    },
    ensureExpandedProjects: (state) => {
      const nextState = ensureExpandedProjectsImpl({
        state,
        expandedProjectIds: options.workspaceState.expandedProjectIds,
        lastAutoExpandedProjectId: options.workspaceState.lastAutoExpandedProjectId,
      });

      if (nextState.didChange) {
        options.workspaceState.expandedProjectIds = nextState.expandedProjectIds;
        runtime.persistExpandedProjectIds();
      }

      options.workspaceState.lastAutoExpandedProjectId = nextState.lastAutoExpandedProjectId;
    },
    renderSidebarDetails: (state) => {
      renderSidebarDetails({
        state,
        sidebarDetailsElement: options.elements.sidebarDetailsElement,
        selectedSidebarItem: options.workspaceState.selectedSidebarItem,
        syncSidebarSelection: options.helpers.syncSidebarSelection,
        renderSidebarDetailsHeader: runtime.renderSidebarDetailsHeader,
        findSidebarProject: options.helpers.findSidebarProject,
        findSidebarChat: options.helpers.findSidebarChat,
        findKnownProjectUrl: options.helpers.findKnownProjectUrl,
        normalizeStoredUrl: options.helpers.normalizeStoredUrl,
        escapeHtml: options.helpers.escapeHtml,
        formatTimestamp: options.helpers.formatTimestamp,
      });
    },
    installSidebarResizer: () => {
      installSidebarResizer(options.elements.sidebarResizerElement, options.elements.appShellElement, {
        startDrag: options.layout.startDrag,
        applySidebarWidth: runtime.applySidebarWidth,
        minSidebarWidth: options.layout.minSidebarWidth,
        maxSidebarWidth: options.layout.maxSidebarWidth,
      });
    },
    installSidebarDetailsResizer: () => {
      installSidebarDetailsResizer(options.elements.sidebarDetailsResizerElement, options.elements.sidebarElement, {
        startDrag: options.layout.startDrag,
        applySidebarDetailsHeight: runtime.applySidebarDetailsHeight,
      });
    },
    installNewFilesPanelResizer: () => {
      installNewFilesPanelResizer(
        options.elements.newFilesPanelResizerElement,
        options.elements.sidebarContentElement,
        options.elements.newFilesPanelElement,
        {
          startDrag: options.layout.startDrag,
          applyNewFilesPanelHeight: runtime.applyNewFilesPanelHeight,
        },
      );
    },
  };

  return runtime;
}
