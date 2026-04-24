import type { AppStateSnapshot } from '../../shared/contracts';
import type { BottomPanelRuntimeState } from '../bottom-panel/runtime';
import type { EditorRuntimeState } from '../editor/runtime';
import type { TreeMenuState } from '../sidebar/types';

export type RendererAppStateAccess = {
  getCurrentState: () => AppStateSnapshot | null;
};

export type RendererTreeMenuStateAccess = {
  getActiveMenu: () => TreeMenuState | null;
  setActiveMenu: (value: TreeMenuState | null) => void;
  getCloseTimer: () => number | null;
  setCloseTimer: (value: number | null) => void;
};

export type RendererEditorStateAccess = {
  getRuntimeState: () => EditorRuntimeState;
  setRuntimeState: (nextState: EditorRuntimeState) => void;
};

export type RendererBottomPanelStateAccess = {
  getRuntimeState: () => BottomPanelRuntimeState;
  setRuntimeState: (nextState: BottomPanelRuntimeState) => void;
};

export type RendererStateAccess = {
  app: RendererAppStateAccess;
  treeMenu: RendererTreeMenuStateAccess;
  editor: RendererEditorStateAccess;
  bottomPanel: RendererBottomPanelStateAccess;
};

export function createRendererStateAccess(state: RendererStateAccess): RendererStateAccess {
  return state;
}
