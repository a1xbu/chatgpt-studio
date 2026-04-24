import type { AppStateSnapshot } from '../../shared/contracts';

export type WorkbenchPanelRenderElements = {
  projectListElement: HTMLElement | null;
  fileViewPanelElement: HTMLElement | null;
  promptViewPanelElement: HTMLElement | null;
};

export function restoreElementScrollTop(element: HTMLElement | null, scrollTop: number): void {
  if (!element) {
    return;
  }

  element.scrollTop = scrollTop;
  requestAnimationFrame(() => {
    element.scrollTop = scrollTop;
  });
}

export function renderProjectTreePanel(
  state: AppStateSnapshot,
  elements: Pick<WorkbenchPanelRenderElements, 'projectListElement'>,
  renderProjectTree: (state: AppStateSnapshot) => string,
): void {
  if (!elements.projectListElement) {
    return;
  }

  elements.projectListElement.innerHTML = renderProjectTree(state);
}

export function renderFileViewPanel(
  state: AppStateSnapshot,
  elements: Pick<WorkbenchPanelRenderElements, 'fileViewPanelElement'>,
  renderLocalFileViewPanel: (state: AppStateSnapshot) => string,
  preserveScroll = false,
): void {
  if (!elements.fileViewPanelElement) {
    return;
  }

  const previousPanelScrollTop = preserveScroll ? elements.fileViewPanelElement.scrollTop : 0;
  const previousTreeScrollTop = preserveScroll
    ? (elements.fileViewPanelElement.querySelector('.file-view-panel__tree') as HTMLElement | null)?.scrollTop ?? 0
    : 0;

  elements.fileViewPanelElement.innerHTML = renderLocalFileViewPanel(state);

  if (!preserveScroll) {
    return;
  }

  restoreElementScrollTop(elements.fileViewPanelElement, previousPanelScrollTop);
  restoreElementScrollTop(elements.fileViewPanelElement.querySelector('.file-view-panel__tree') as HTMLElement | null, previousTreeScrollTop);
}

export function renderPromptSidebarPanel(
  elements: Pick<WorkbenchPanelRenderElements, 'promptViewPanelElement'>,
  renderPromptViewPanel: () => string,
  renderPromptMenuPortal: () => void,
): void {
  if (!elements.promptViewPanelElement) {
    return;
  }

  const previousScrollTop = elements.promptViewPanelElement.scrollTop;
  const previousTreeScrollTop = (elements.promptViewPanelElement.querySelector('.file-view-panel__tree') as HTMLElement | null)?.scrollTop ?? 0;
  elements.promptViewPanelElement.innerHTML = renderPromptViewPanel();
  restoreElementScrollTop(elements.promptViewPanelElement, previousScrollTop);
  restoreElementScrollTop(elements.promptViewPanelElement.querySelector('.file-view-panel__tree') as HTMLElement | null, previousTreeScrollTop);
  renderPromptMenuPortal();
}
