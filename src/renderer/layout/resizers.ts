export type DragHandleElements = {
  appShellElement: HTMLElement | null;
  dragShieldElement: HTMLElement | null;
};

export function startDrag(
  elements: DragHandleElements,
  cursor: 'col-resize' | 'row-resize',
  onMove: (event: PointerEvent) => void,
): void {
  const { appShellElement, dragShieldElement } = elements;
  if (!appShellElement || !dragShieldElement) {
    return;
  }

  dragShieldElement.hidden = false;
  dragShieldElement.dataset.cursor = cursor;
  appShellElement.classList.add('app-shell--dragging');

  const stopDrag = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDrag);
    window.removeEventListener('pointercancel', stopDrag);
    window.removeEventListener('blur', stopDrag);
    dragShieldElement.hidden = true;
    delete dragShieldElement.dataset.cursor;
    appShellElement.classList.remove('app-shell--dragging');
  };

  const handlePointerMove = (event: PointerEvent) => {
    onMove(event);
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', stopDrag, { once: true });
  window.addEventListener('pointercancel', stopDrag, { once: true });
  window.addEventListener('blur', stopDrag, { once: true });
}

export function installSidebarResizer(
  sidebarResizerElement: HTMLElement | null,
  appShellElement: HTMLElement | null,
  helpers: {
    startDrag: (cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void) => void;
    applySidebarWidth: (width: number) => void;
    minSidebarWidth: number;
    maxSidebarWidth: number;
  },
): void {
  if (!sidebarResizerElement || !appShellElement) {
    return;
  }

  sidebarResizerElement.addEventListener('pointerdown', (event) => {
    event.preventDefault();

    helpers.startDrag('col-resize', (moveEvent) => {
      const appRect = appShellElement.getBoundingClientRect();
      const width = Math.min(helpers.maxSidebarWidth, Math.max(helpers.minSidebarWidth, moveEvent.clientX - appRect.left));
      helpers.applySidebarWidth(width);
    });
  });
}

export function installSidebarDetailsResizer(
  sidebarDetailsResizerElement: HTMLElement | null,
  sidebarElement: HTMLElement | null,
  helpers: {
    startDrag: (cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void) => void;
    applySidebarDetailsHeight: (height: number) => void;
  },
): void {
  if (!sidebarDetailsResizerElement || !sidebarElement) {
    return;
  }

  sidebarDetailsResizerElement.addEventListener('pointerdown', (event) => {
    event.preventDefault();

    helpers.startDrag('row-resize', (moveEvent) => {
      const sidebarRect = sidebarElement.getBoundingClientRect();
      const height = Math.round(sidebarRect.bottom - moveEvent.clientY);
      helpers.applySidebarDetailsHeight(height);
    });
  });
}

export function installBottomPanelResizer(
  bottomPanelResizerElement: HTMLElement | null,
  workbenchElement: HTMLElement | null,
  helpers: {
    isDebugPanelCollapsed: () => boolean;
    startDrag: (cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void) => void;
    applyDebugPanelHeight: (height: number) => void;
    scheduleTerminalFit: () => void;
    minDebugPanelHeight: number;
    maxDebugPanelHeight: number;
  },
): void {
  if (!bottomPanelResizerElement || !workbenchElement) {
    return;
  }

  bottomPanelResizerElement.addEventListener('pointerdown', (event) => {
    if (helpers.isDebugPanelCollapsed()) {
      return;
    }

    event.preventDefault();

    helpers.startDrag('row-resize', (moveEvent) => {
      const workbenchRect = workbenchElement.getBoundingClientRect();
      const maxHeight = Math.max(helpers.minDebugPanelHeight, Math.min(helpers.maxDebugPanelHeight, workbenchRect.height - 140));
      const height = Math.min(maxHeight, Math.max(helpers.minDebugPanelHeight, workbenchRect.bottom - moveEvent.clientY));
      helpers.applyDebugPanelHeight(height);
      helpers.scheduleTerminalFit();
    });
  });
}

export function installNewFilesPanelResizer(
  newFilesPanelResizerElement: HTMLElement | null,
  sidebarContentElement: HTMLElement | null,
  newFilesPanelElement: HTMLElement | null,
  helpers: {
    startDrag: (cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void) => void;
    applyNewFilesPanelHeight: (height: number) => void;
  },
): void {
  if (!newFilesPanelResizerElement || !sidebarContentElement) {
    return;
  }

  newFilesPanelResizerElement.addEventListener('pointerdown', (event) => {
    if (
      newFilesPanelElement?.classList.contains('new-files-panel--collapsed')
      || !newFilesPanelResizerElement.classList.contains('new-files-panel-resizer--visible')
    ) {
      return;
    }

    event.preventDefault();

    helpers.startDrag('row-resize', (moveEvent) => {
      const sidebarRect = sidebarContentElement.getBoundingClientRect();
      const height = Math.round(sidebarRect.bottom - moveEvent.clientY);
      helpers.applyNewFilesPanelHeight(height);
    });
  });
}
