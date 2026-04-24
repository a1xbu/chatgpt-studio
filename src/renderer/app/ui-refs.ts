import type { WebviewElement } from '../runtime-types';

type RendererUiDocumentLike = Pick<Document, 'body' | 'createElement' | 'getElementById' | 'querySelector'>;

export type RendererUiRefs = {
  projectListElement: HTMLElement | null;
  newFilesPanelElement: HTMLElement | null;
  fileViewPanelElement: HTMLElement | null;
  promptViewPanelElement: HTMLElement | null;
  sidebarActivityElement: HTMLElement | null;
  sidebarPanelExplorerElement: HTMLElement | null;
  sidebarPanelFilesElement: HTMLElement | null;
  sidebarPanelPromptsElement: HTMLElement | null;
  sidebarContentElement: HTMLElement | null;
  newFilesPanelResizerElement: HTMLElement | null;
  sidebarElement: HTMLElement | null;
  sidebarDetailsElement: HTMLElement | null;
  sidebarDetailsResizerElement: HTMLElement | null;
  editorTabsElement: HTMLElement | null;
  browserToolbarElement: HTMLElement | null;
  browserToolbarControlsElement: HTMLElement | null;
  backButton: HTMLButtonElement | null;
  forwardButton: HTMLButtonElement | null;
  refreshStopButton: HTMLButtonElement | null;
  browserAddressFormElement: HTMLFormElement | null;
  toggleBottomPanelButton: HTMLButtonElement | null;
  clearDebugButton: HTMLButtonElement | null;
  copyDebugButton: HTMLButtonElement | null;
  openTerminalButton: HTMLButtonElement | null;
  bottomTabsElement: HTMLElement | null;
  browserUrlElement: HTMLInputElement | null;
  browserViewElement: HTMLElement | null;
  browserElement: WebviewElement | null;
  chatHistoryViewElement: HTMLElement | null;
  promptEditorViewElement: HTMLElement | null;
  appShellElement: HTMLElement | null;
  debugConsoleElement: HTMLElement | null;
  debugFilterInputElement: HTMLInputElement | null;
  debugRetentionElement: HTMLElement | null;
  debugViewElement: HTMLElement | null;
  terminalViewElement: HTMLElement | null;
  terminalPaneElement: HTMLElement | null;
  terminalEmptyElement: HTMLElement | null;
  terminalMetaElement: HTMLElement | null;
  terminalHostElement: HTMLElement | null;
  gitViewElement: HTMLElement | null;
  sidebarResizerElement: HTMLElement | null;
  bottomPanelResizerElement: HTMLElement | null;
  dragShieldElement: HTMLElement | null;
  workbenchElement: HTMLElement | null;
  overlayRootElement: HTMLElement;
};

function getById<T extends HTMLElement = HTMLElement>(documentLike: RendererUiDocumentLike, id: string): T | null {
  return documentLike.getElementById(id) as T | null;
}

function query<T extends HTMLElement = HTMLElement>(documentLike: RendererUiDocumentLike, selector: string): T | null {
  return documentLike.querySelector(selector) as T | null;
}

export function ensureOverlayRoot(documentLike: RendererUiDocumentLike): HTMLElement {
  const existing = getById(documentLike, 'overlay-root');
  if (existing) {
    return existing;
  }

  const overlayRootElement = documentLike.createElement('div');
  overlayRootElement.id = 'overlay-root';
  documentLike.body.append(overlayRootElement);
  return overlayRootElement as HTMLElement;
}

export function createRendererUiRefs(documentLike: RendererUiDocumentLike): RendererUiRefs {
  return {
    projectListElement: getById(documentLike, 'project-list'),
    newFilesPanelElement: getById(documentLike, 'new-files-panel'),
    fileViewPanelElement: getById(documentLike, 'file-view-panel'),
    promptViewPanelElement: getById(documentLike, 'prompt-view-panel'),
    sidebarActivityElement: getById(documentLike, 'sidebar-activity'),
    sidebarPanelExplorerElement: getById(documentLike, 'sidebar-panel-explorer'),
    sidebarPanelFilesElement: getById(documentLike, 'sidebar-panel-files'),
    sidebarPanelPromptsElement: getById(documentLike, 'sidebar-panel-prompts'),
    sidebarContentElement: query(documentLike, '.sidebar-content'),
    newFilesPanelResizerElement: getById(documentLike, 'new-files-panel-resizer'),
    sidebarElement: query(documentLike, '.sidebar'),
    sidebarDetailsElement: getById(documentLike, 'sidebar-details'),
    sidebarDetailsResizerElement: getById(documentLike, 'sidebar-details-resizer'),
    editorTabsElement: getById(documentLike, 'editor-tabs'),
    browserToolbarElement: getById(documentLike, 'browser-toolbar'),
    browserToolbarControlsElement: query(documentLike, '.browser-toolbar-controls'),
    backButton: getById(documentLike, 'browser-back'),
    forwardButton: getById(documentLike, 'browser-forward'),
    refreshStopButton: getById(documentLike, 'browser-refresh-stop'),
    browserAddressFormElement: getById(documentLike, 'browser-address-form'),
    toggleBottomPanelButton: getById(documentLike, 'toggle-debug-panel-bottom'),
    clearDebugButton: getById(documentLike, 'clear-debug'),
    copyDebugButton: getById(documentLike, 'copy-debug'),
    openTerminalButton: getById(documentLike, 'open-terminal'),
    bottomTabsElement: getById(documentLike, 'bottom-tabs'),
    browserUrlElement: getById(documentLike, 'browser-url'),
    browserViewElement: getById(documentLike, 'browser-view'),
    browserElement: getById(documentLike, 'chatgpt-browser') as WebviewElement | null,
    chatHistoryViewElement: getById(documentLike, 'chat-history-view'),
    promptEditorViewElement: getById(documentLike, 'prompt-editor-view'),
    appShellElement: getById(documentLike, 'app-shell'),
    debugConsoleElement: getById(documentLike, 'debug-console'),
    debugFilterInputElement: getById(documentLike, 'debug-filter'),
    debugRetentionElement: getById(documentLike, 'debug-retention'),
    debugViewElement: getById(documentLike, 'debug-view'),
    terminalViewElement: getById(documentLike, 'terminal-view'),
    terminalPaneElement: getById(documentLike, 'terminal-pane'),
    terminalEmptyElement: getById(documentLike, 'terminal-empty'),
    terminalMetaElement: getById(documentLike, 'terminal-meta'),
    terminalHostElement: getById(documentLike, 'terminal-host'),
    gitViewElement: getById(documentLike, 'git-view'),
    sidebarResizerElement: getById(documentLike, 'sidebar-resizer'),
    bottomPanelResizerElement: getById(documentLike, 'bottom-panel-resizer'),
    dragShieldElement: getById(documentLike, 'drag-shield'),
    workbenchElement: query(documentLike, '.workbench'),
    overlayRootElement: ensureOverlayRoot(documentLike),
  };
}
