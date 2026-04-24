import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PromptDirectorySnapshot, PromptRecord } from '../shared/contracts';

function normalizePromptBaseName(value: string): string {
  const trimmed = value.trim();
  const withoutExtension = trimmed.toLowerCase().endsWith('.md') ? trimmed.slice(0, -3) : trimmed;
  const normalized = withoutExtension.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error('Prompt name cannot be empty.');
  }

  if (/[\\/:*?"<>|]/.test(normalized)) {
    throw new Error('Prompt name contains characters that are not allowed in file names.');
  }

  if (normalized === '.' || normalized === '..') {
    throw new Error('Prompt name is not valid.');
  }

  return normalized;
}

function buildPromptFileName(baseName: string): string {
  return `${baseName}.md`;
}

function toPromptId(fileName: string): string {
  return fileName.toLowerCase();
}

export class PromptStore {
  constructor(private readonly promptsDirectoryPath: string) {}

  getDirectoryPath(): string {
    return this.promptsDirectoryPath;
  }

  async ensureDirectory(): Promise<string> {
    await mkdir(this.promptsDirectoryPath, { recursive: true });
    return this.promptsDirectoryPath;
  }

  private async readPromptDirectory(): Promise<PromptRecord[]> {
    await this.ensureDirectory();
    const entries = await readdir(this.promptsDirectoryPath, { withFileTypes: true });
    const prompts = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map(async (entry) => {
        const fullPath = path.join(this.promptsDirectoryPath, entry.name);
        const entryStat = await stat(fullPath);
        const title = entry.name.replace(/\.md$/i, '');
        return {
          id: toPromptId(entry.name),
          title,
          fileName: entry.name,
          fullPath,
          updatedAt: entryStat.mtime.toISOString(),
          createdAt: entryStat.birthtime.toISOString(),
          sizeBytes: entryStat.size,
        } satisfies PromptRecord;
      }));

    prompts.sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base', numeric: true }));
    return prompts;
  }

  async listPrompts(): Promise<PromptDirectorySnapshot> {
    return {
      directoryPath: await this.ensureDirectory(),
      prompts: await this.readPromptDirectory(),
    };
  }

  async createPrompt(name: string): Promise<PromptRecord> {
    const baseName = normalizePromptBaseName(name);
    const fileName = buildPromptFileName(baseName);
    const fullPath = path.join(await this.ensureDirectory(), fileName);

    try {
      await access(fullPath);
      throw new Error(`Prompt "${baseName}" already exists.`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Prompt "')) {
        throw error;
      }
    }

    await writeFile(fullPath, '', { encoding: 'utf8', flag: 'wx' });
    const entryStat = await stat(fullPath);
    return {
      id: toPromptId(fileName),
      title: baseName,
      fileName,
      fullPath,
      updatedAt: entryStat.mtime.toISOString(),
      createdAt: entryStat.birthtime.toISOString(),
      sizeBytes: entryStat.size,
    };
  }

  async renamePrompt(promptId: string, nextName: string): Promise<PromptRecord> {
    const snapshot = await this.listPrompts();
    const current = snapshot.prompts.find((entry) => entry.id === promptId) ?? null;
    if (!current) {
      throw new Error('Prompt was not found.');
    }

    const baseName = normalizePromptBaseName(nextName);
    const nextFileName = buildPromptFileName(baseName);
    const nextFullPath = path.join(snapshot.directoryPath, nextFileName);
    if (nextFullPath !== current.fullPath) {
      try {
        await access(nextFullPath);
        throw new Error(`Prompt "${baseName}" already exists.`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Prompt "')) {
          throw error;
        }
      }

      await rename(current.fullPath, nextFullPath);
    }

    const entryStat = await stat(nextFullPath);
    return {
      id: toPromptId(nextFileName),
      title: baseName,
      fileName: nextFileName,
      fullPath: nextFullPath,
      updatedAt: entryStat.mtime.toISOString(),
      createdAt: entryStat.birthtime.toISOString(),
      sizeBytes: entryStat.size,
    };
  }

  async deletePrompt(promptId: string): Promise<boolean> {
    const snapshot = await this.listPrompts();
    const current = snapshot.prompts.find((entry) => entry.id === promptId) ?? null;
    if (!current) {
      return false;
    }

    await rm(current.fullPath, { force: true });
    return true;
  }

  async readPrompt(promptId: string): Promise<{ prompt: PromptRecord; content: string } | null> {
    const snapshot = await this.listPrompts();
    const current = snapshot.prompts.find((entry) => entry.id === promptId) ?? null;
    if (!current) {
      return null;
    }

    const content = await readFile(current.fullPath, 'utf8');
    return { prompt: current, content };
  }

  async writePrompt(promptId: string, content: string): Promise<PromptRecord> {
    const snapshot = await this.listPrompts();
    const current = snapshot.prompts.find((entry) => entry.id === promptId) ?? null;
    if (!current) {
      throw new Error('Prompt was not found.');
    }

    await writeFile(current.fullPath, content, 'utf8');
    const entryStat = await stat(current.fullPath);
    return {
      ...current,
      updatedAt: entryStat.mtime.toISOString(),
      sizeBytes: entryStat.size,
    };
  }
}
