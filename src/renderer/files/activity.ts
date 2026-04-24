export type LocalFileActivityEntry = {
  kind: 'file' | 'directory';
  createdAt: string | null;
  modifiedAt: string | null;
};

export function formatTreeTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isRecentFileActivity(value: string | null | undefined, recentWindowMs: number): boolean {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return Date.now() - parsed.getTime() <= recentWindowMs;
}

export function hasSyntheticCreatedAt(entry: LocalFileActivityEntry): boolean {
  if (!entry.createdAt || !entry.modifiedAt) {
    return false;
  }

  const createdAt = new Date(entry.createdAt);
  const modifiedAt = new Date(entry.modifiedAt);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(modifiedAt.getTime())) {
    return false;
  }

  return createdAt.getTime() - modifiedAt.getTime() > 5000;
}

export function classifyLocalFileActivity(
  entry: LocalFileActivityEntry,
  recentWindowMs: number,
): 'unchanged' | 'new' | 'modified' {
  const isNew = entry.kind === 'file' && !hasSyntheticCreatedAt(entry) && isRecentFileActivity(entry.createdAt, recentWindowMs);
  if (isNew) {
    return 'new';
  }

  const isModified = entry.kind === 'file' && isRecentFileActivity(entry.modifiedAt, recentWindowMs);
  return isModified ? 'modified' : 'unchanged';
}
