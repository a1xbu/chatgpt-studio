import {
  createRendererTreeMenuRuntimeOptions,
  type RendererContext,
} from '../app/context';
import {
  clearManagedMenuCloseTimer,
  closeManagedMenu,
  scheduleManagedMenuClose,
  type ManagedMenuRuntimeOptions,
} from '../ui/menu-runtime';
import type { TreeMenuState } from './types';

export type RendererTreeMenuRuntime = {
  getRuntimeOptions: () => ManagedMenuRuntimeOptions<TreeMenuState>;
  clearCloseTimer: () => void;
  close: (shouldRender?: boolean) => void;
  scheduleClose: (delayMs?: number) => void;
};

export type CreateRendererTreeMenuRuntimeOptions = {
  getContext: () => RendererContext;
  getTreeMenuKey: (state: TreeMenuState | null) => string;
};

export function createRendererTreeMenuRuntime(
  options: CreateRendererTreeMenuRuntimeOptions,
): RendererTreeMenuRuntime {
  function getRuntimeOptions(): ManagedMenuRuntimeOptions<TreeMenuState> {
    return createRendererTreeMenuRuntimeOptions(options.getContext(), options.getTreeMenuKey);
  }

  return {
    getRuntimeOptions,
    clearCloseTimer: () => {
      clearManagedMenuCloseTimer(getRuntimeOptions());
    },
    close: (shouldRender = true) => {
      closeManagedMenu(getRuntimeOptions(), shouldRender);
    },
    scheduleClose: (delayMs = 5000) => {
      scheduleManagedMenuClose(getRuntimeOptions(), delayMs);
    },
  };
}
