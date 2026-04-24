
import type { AppStateSnapshot, DebugLogEntry } from '../../shared/contracts';
import type { BootstrapPayload, TerminalSessionSnapshot, TerminalSessionState } from '../desktop-api';
import type { SidebarSelection } from '../sidebar/types';
import type { FileDownloadRuntimeStatus, WebviewElement } from '../runtime-types';
import { bindRendererRuntimeSubscriptions, type RuntimeSubscriptionOptions } from '../runtime/subscriptions';

export type BootstrapBrowserController = {
  updateUrl: (url: string) => void;
  syncControls: () => void;
};

export type RunRendererBootstrapOptions = {
  browserElement: WebviewElement | null;
  browserUrlElement: HTMLInputElement | null;
  applyInitialUiState: () => void;
  getBootstrap: () => Promise<BootstrapPayload>;
  setCurrentState: (state: AppStateSnapshot) => void;
  syncProjectFileSignatures: (state: AppStateSnapshot) => void;
  setDebugLogs: (entries: DebugLogEntry[]) => void;
  maxDebugLogs: number;
  createTerminalSessionState: (snapshot: TerminalSessionSnapshot) => TerminalSessionState;
  setTerminalSessions: (sessions: TerminalSessionState[]) => void;
  refreshPrompts: () => Promise<void>;
  runtimeOptions: RuntimeSubscriptionOptions;
  resolveStartupBrowserUrl: (state: AppStateSnapshot, payload: BootstrapPayload) => string;
  resolveStartupBrowserSelection: (state: AppStateSnapshot) => SidebarSelection | null;
  setBrowserOpenedSidebarItem: (selection: SidebarSelection | null) => void;
  persistBrowserOpenedSelection: () => void;
  browserController: BootstrapBrowserController;
  queueAutomaticSandboxDownloads: () => void;
  render: () => void;
  restoreLastOpenState: (state: AppStateSnapshot) => Promise<void>;
};

export async function runRendererBootstrap(options: RunRendererBootstrapOptions): Promise<void> {
  if (!options.browserElement || !options.browserUrlElement) {
    return;
  }

  options.applyInitialUiState();

  const bootstrapPayload = await options.getBootstrap();
  const currentState = bootstrapPayload.state;
  options.setCurrentState(currentState);
  options.syncProjectFileSignatures(currentState);
  options.setDebugLogs(bootstrapPayload.debugLogs.slice(-options.maxDebugLogs));
  options.setTerminalSessions(bootstrapPayload.terminalSnapshots.map((snapshot) => options.createTerminalSessionState(snapshot)));
  await options.refreshPrompts();

  bindRendererRuntimeSubscriptions(options.runtimeOptions);

  const startupBrowserUrl = options.resolveStartupBrowserUrl(currentState, bootstrapPayload);
  const startupBrowserSelection = options.resolveStartupBrowserSelection(currentState);
  if (startupBrowserSelection) {
    options.setBrowserOpenedSidebarItem(startupBrowserSelection);
    options.persistBrowserOpenedSelection();
  }

  options.browserElement.setAttribute('partition', bootstrapPayload.browser.partition);
  options.browserElement.setAttribute('preload', bootstrapPayload.browser.preloadUrl);
  options.browserElement.setAttribute('src', startupBrowserUrl);
  options.browserController.updateUrl(startupBrowserUrl);
  options.browserController.syncControls();

  options.queueAutomaticSandboxDownloads();
  options.render();
  void options.restoreLastOpenState(currentState);
}
