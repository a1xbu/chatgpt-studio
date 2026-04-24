import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ProjectBinding } from '../shared/contracts';

interface PersistedAppStore {
  version: 1;
  bindings: ProjectBinding[];
}

const DEFAULT_STORE: PersistedAppStore = {
  version: 1,
  bindings: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanupText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeBinding(value: unknown): ProjectBinding | null {
  if (!isRecord(value)) {
    return null;
  }

  const projectId = cleanupText(value.projectId);
  const projectName = cleanupText(value.projectName);
  const folderPath = cleanupText(value.folderPath);
  const projectUrl = cleanupText(value.projectUrl ?? value.sourceUrl) || null;
  const createdAt = cleanupText(value.createdAt) || new Date(0).toISOString();
  const updatedAt = cleanupText(value.updatedAt) || createdAt;

  if (!projectId || !projectName || !folderPath) {
    return null;
  }

  return {
    projectId,
    projectName,
    folderPath,
    projectUrl,
    createdAt,
    updatedAt,
  };
}

export class JsonAppStore {
  public constructor(private readonly storePath: string) {}

  public get path(): string {
    return this.storePath;
  }

  public load(): PersistedAppStore {
    if (!existsSync(this.storePath)) {
      return DEFAULT_STORE;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.storePath, 'utf8')) as unknown;
      if (!isRecord(parsed) || !Array.isArray(parsed.bindings)) {
        return DEFAULT_STORE;
      }

      return {
        version: 1,
        bindings: parsed.bindings.map((entry) => normalizeBinding(entry)).filter((entry): entry is ProjectBinding => Boolean(entry)),
      };
    } catch {
      return DEFAULT_STORE;
    }
  }

  public save(nextState: PersistedAppStore): void {
    mkdirSync(path.dirname(this.storePath), { recursive: true });
    writeFileSync(this.storePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  }
}
