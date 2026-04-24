import type { BrowserController } from '../browser/controller';
import type { DesktopPocApi } from '../desktop-api';
import type { ChatEditorTab, PromptEditorTab } from '../editor/types';
import type { TreeMenuState } from '../sidebar/types';
import type { ManagedMenuRuntimeOptions } from '../ui/menu-runtime';
import type { RendererTimers } from './timers';
import type { RendererStateAccess } from './state-access';

export type RendererServices = {
  desktopPoc: DesktopPocApi;
  browserController: BrowserController;
  storage: Storage;
  timers: RendererTimers;
};

export type RendererRenderHooks = {
  render: () => void;
  renderEditorArea: () => void;
  renderBottomPanel: () => void;
  applyDebugPanelState: () => void;
  scheduleTerminalFit: () => void;
  syncActiveTerminalViewport: (force?: boolean) => void;
  syncSelectionWithActiveEditorTab: () => void;
  persistActiveLocalChatSelection: () => void;
  loadChatHistoryIntoTab: (tab: ChatEditorTab, forceReload?: boolean) => Promise<void>;
  loadPromptIntoTab: (tab: PromptEditorTab, forceReload?: boolean) => Promise<void>;
  savePromptTab: (tab: PromptEditorTab) => Promise<void>;
};

export type RendererContext = {
  services: RendererServices;
  state: RendererStateAccess;
  renderHooks: RendererRenderHooks;
};

export function createRendererContext(context: RendererContext): RendererContext {
  return context;
}

export function createRendererTreeMenuRuntimeOptions(
  context: RendererContext,
  getMenuKey: (state: TreeMenuState | null) => string,
): ManagedMenuRuntimeOptions<TreeMenuState> {
  return {
    getActiveMenu: context.state.treeMenu.getActiveMenu,
    setActiveMenu: context.state.treeMenu.setActiveMenu,
    getCloseTimer: context.state.treeMenu.getCloseTimer,
    setCloseTimer: context.state.treeMenu.setCloseTimer,
    clearTimeout: context.services.timers.clearTimeout,
    setTimeout: context.services.timers.setTimeout,
    render: context.renderHooks.render,
    getMenuKey,
  };
}
