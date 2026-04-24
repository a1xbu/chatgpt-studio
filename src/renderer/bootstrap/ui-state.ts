import type { SidebarSelection } from '../sidebar/types';
import {
  loadInitialDebugCollapsed,
  loadInitialDebugHeight,
  loadInitialDebugRetention,
  loadInitialSidebarSelection,
  loadInitialSidebarWidth,
} from '../sidebar/storage';

export type ApplyInitialRendererUiStateOptions = {
  storage: Storage;
  sidebarWidthStorageKey: string;
  debugHeightStorageKey: string;
  debugRetentionStorageKey: string;
  sidebarSelectionStorageKey: string;
  debugCollapsedStorageKey: string;
  minSidebarWidth: number;
  maxSidebarWidth: number;
  minDebugPanelHeight: number;
  maxDebugPanelHeight: number;
  applySidebarWidth: (width: number) => void;
  applySidebarTabState: () => void;
  applyDebugPanelHeight: (height: number) => void;
  setDebugRetentionLimit: (value: number) => void;
  setSelectedSidebarItem: (value: SidebarSelection | null) => void;
  setIsDebugPanelCollapsed: (value: boolean) => void;
  applyDebugPanelState: () => void;
  installSidebarResizer: () => void;
  installSidebarDetailsResizer: () => void;
  installBottomPanelResizer: () => void;
  installNewFilesPanelResizer: () => void;
};

export function applyInitialRendererUiState(options: ApplyInitialRendererUiStateOptions): void {
  options.applySidebarWidth(
    loadInitialSidebarWidth(
      options.storage,
      options.sidebarWidthStorageKey,
      options.minSidebarWidth,
      options.maxSidebarWidth,
    ),
  );
  options.applySidebarTabState();
  options.applyDebugPanelHeight(
    loadInitialDebugHeight(
      options.storage,
      options.debugHeightStorageKey,
      options.minDebugPanelHeight,
      options.maxDebugPanelHeight,
    ),
  );
  options.setDebugRetentionLimit(loadInitialDebugRetention(options.storage, options.debugRetentionStorageKey));
  options.setSelectedSidebarItem(loadInitialSidebarSelection(options.storage, options.sidebarSelectionStorageKey));
  options.setIsDebugPanelCollapsed(loadInitialDebugCollapsed(options.storage, options.debugCollapsedStorageKey));
  options.applyDebugPanelState();
  options.installSidebarResizer();
  options.installSidebarDetailsResizer();
  options.installBottomPanelResizer();
  options.installNewFilesPanelResizer();
}
