export type StoredSidebarSelection =
  | {
      kind: 'project';
      projectId: string;
    }
  | {
      kind: 'chat';
      projectId: string;
      chatId: string;
    };

export type SidebarTabId = 'explorer' | 'files' | 'prompts';

export function loadInitialSidebarWidth(storage: Storage, storageKey: string, minWidth: number, maxWidth: number): number {
  const storedValue = Number(storage.getItem(storageKey));
  if (!Number.isFinite(storedValue)) {
    return 318;
  }

  return Math.min(maxWidth, Math.max(minWidth, storedValue));
}

export function loadInitialDebugCollapsed(storage: Storage, storageKey: string): boolean {
  return storage.getItem(storageKey) === 'true';
}

export function loadInitialDebugHeight(storage: Storage, storageKey: string, minHeight: number, maxHeight: number): number {
  const storedValue = Number(storage.getItem(storageKey));
  if (!Number.isFinite(storedValue)) {
    return 218;
  }

  return Math.min(maxHeight, Math.max(minHeight, storedValue));
}

export function loadInitialDebugRetention(storage: Storage, storageKey: string): number {
  const storedValue = Number(storage.getItem(storageKey));
  return storedValue === 1000 ? 1000 : 100;
}

export function loadInitialSidebarDetailsHeight(storage: Storage, storageKey: string, sidebarHeight: number): number {
  const storedValue = Number(storage.getItem(storageKey));
  if (Number.isFinite(storedValue)) {
    return storedValue;
  }

  return Math.round(sidebarHeight * 0.3);
}

export function loadInitialSidebarDetailsCollapsed(storage: Storage, storageKey: string): boolean {
  const storedValue = storage.getItem(storageKey);
  if (storedValue === null) {
    return true;
  }

  return storedValue !== 'false';
}

export function loadInitialSidebarTab(storage: Storage, storageKey: string): SidebarTabId {
  const storedValue = storage.getItem(storageKey);
  return storedValue === 'files' || storedValue === 'prompts' ? storedValue : 'explorer';
}

export function loadInitialNewFilesCollapsed(storage: Storage, storageKey: string): boolean {
  return storage.getItem(storageKey) === 'true';
}

export function loadInitialNewFilesHeight(storage: Storage, storageKey: string): number | null {
  const storedValue = Number(storage.getItem(storageKey));
  return Number.isFinite(storedValue) ? storedValue : null;
}

export function parseStoredSidebarSelection(storedValue: string | null): StoredSidebarSelection | null {
  try {
    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (candidate.kind === 'project' && typeof candidate.projectId === 'string') {
      return { kind: 'project', projectId: candidate.projectId };
    }

    if (candidate.kind === 'chat' && typeof candidate.projectId === 'string' && typeof candidate.chatId === 'string') {
      return { kind: 'chat', projectId: candidate.projectId, chatId: candidate.chatId };
    }
  } catch {
    return null;
  }

  return null;
}

export function loadInitialSidebarSelection(storage: Storage, storageKey: string): StoredSidebarSelection | null {
  return parseStoredSidebarSelection(storage.getItem(storageKey));
}

export function loadLastBrowserOpenedSelection(storage: Storage, storageKey: string): StoredSidebarSelection | null {
  return parseStoredSidebarSelection(storage.getItem(storageKey));
}

export function loadLastActiveLocalChatSelection(storage: Storage, storageKey: string): Extract<StoredSidebarSelection, { kind: 'chat' }> | null {
  const parsed = parseStoredSidebarSelection(storage.getItem(storageKey));
  return parsed?.kind === 'chat' ? parsed : null;
}

export function loadExpandedProjectIds(storage: Storage, storageKey: string): Set<string> {
  try {
    const storedValue = storage.getItem(storageKey);
    const parsed = storedValue ? (JSON.parse(storedValue) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set<string>();
  }
}
