export type ManagedMenuRuntimeOptions<TState> = {
  getActiveMenu: () => TState | null;
  setActiveMenu: (value: TState | null) => void;
  getCloseTimer: () => number | null;
  setCloseTimer: (value: number | null) => void;
  clearTimeout: (timerId: number) => void;
  setTimeout: (callback: () => void, delayMs: number) => number;
  render: () => void;
  getMenuKey: (state: TState | null) => string;
};

export function clearManagedMenuCloseTimer<TState>(options: ManagedMenuRuntimeOptions<TState>): void {
  const timerId = options.getCloseTimer();
  if (timerId === null) {
    return;
  }

  options.clearTimeout(timerId);
  options.setCloseTimer(null);
}

export function closeManagedMenu<TState>(options: ManagedMenuRuntimeOptions<TState>, shouldRender = true): void {
  clearManagedMenuCloseTimer(options);
  if (!options.getActiveMenu()) {
    return;
  }

  options.setActiveMenu(null);
  if (shouldRender) {
    options.render();
  }
}

export function scheduleManagedMenuClose<TState>(options: ManagedMenuRuntimeOptions<TState>, delayMs = 5000): void {
  clearManagedMenuCloseTimer(options);
  if (!options.getActiveMenu()) {
    return;
  }

  const timerId = options.setTimeout(() => {
    options.setCloseTimer(null);
    if (!options.getActiveMenu()) {
      return;
    }

    options.setActiveMenu(null);
    options.render();
  }, delayMs);

  options.setCloseTimer(timerId);
}

export function toggleManagedMenu<TState>(nextMenu: TState, options: ManagedMenuRuntimeOptions<TState>, shouldToggle = true): void {
  const activeMenu = options.getActiveMenu();
  const nextState = shouldToggle && options.getMenuKey(activeMenu) === options.getMenuKey(nextMenu)
    ? null
    : nextMenu;

  options.setActiveMenu(nextState);
  clearManagedMenuCloseTimer(options);
  options.render();
}
