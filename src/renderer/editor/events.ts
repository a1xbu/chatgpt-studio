export type EditorTabsEventsElements = {
  editorTabsElement: HTMLElement | null;
};

export type EditorTabsEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  closeEditorTab: (tabId: string) => void;
  activatePairedEditorView: (view: 'browser' | 'local') => void;
  activateEditorTab: (tabId: string) => void;
};

export function bindEditorTabsEvents(
  elements: EditorTabsEventsElements,
  helpers: EditorTabsEventsHelpers,
): void {
  elements.editorTabsElement?.addEventListener('click', (event) => {
    const closeButton = helpers.findClosestHtmlElement(event.target, '[data-action="close-editor-tab"]');
    if (closeButton) {
      event.preventDefault();
      event.stopPropagation();

      const tabId = closeButton.dataset.editorTabId ?? '';
      if (tabId) {
        helpers.closeEditorTab(tabId);
      }
      return;
    }

    const pairedSwitchButton = helpers.findClosestHtmlElement(event.target, '[data-action="switch-paired-tab-view"]');
    if (pairedSwitchButton) {
      event.preventDefault();
      helpers.activatePairedEditorView(pairedSwitchButton.dataset.pairedView === 'local' ? 'local' : 'browser');
      return;
    }

    const tabButton = helpers.findClosestHtmlElement(event.target, '[data-editor-tab-id]');
    if (!tabButton) {
      return;
    }

    event.preventDefault();
    helpers.activateEditorTab(tabButton.dataset.editorTabId ?? 'browser');
  });
}
