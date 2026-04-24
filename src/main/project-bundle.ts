import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import ignore from 'ignore';
import { REMOTE_MANIFEST_FILE, type ProjectBundleFileRecord, type RemoteManifest } from '../shared/contracts';

const META_DIRECTORY_NAME = '.chatgpt';
const BUNDLES_DIRECTORY_NAME = 'bundles';

function normalizeRemoteManifest(value: unknown, projectId: string): RemoteManifest {
  const normalizedProjectId = String(projectId || '').trim();
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  candidate.project_id = normalizedProjectId;

  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : undefined;
  if (summary) {
    candidate.summary = summary;
  } else {
    delete candidate.summary;
  }

  const projectRootInArchive = typeof candidate.project_root_in_archive === 'string' ? candidate.project_root_in_archive.trim() : undefined;
  if (projectRootInArchive) {
    candidate.project_root_in_archive = projectRootInArchive;
  } else {
    delete candidate.project_root_in_archive;
  }

  return candidate as unknown as RemoteManifest;
}

async function ensureRemoteManifest(projectFolderPath: string, projectId: string): Promise<string> {
  const manifestPath = path.join(projectFolderPath, ...REMOTE_MANIFEST_FILE.split('/'));
  await fsPromises.mkdir(path.dirname(manifestPath), { recursive: true });

  let existingValue: unknown = {};
  if (existsSync(manifestPath)) {
    try {
      existingValue = JSON.parse(await fsPromises.readFile(manifestPath, 'utf8'));
    } catch {
      existingValue = {};
    }
  }

  const nextManifest = normalizeRemoteManifest(existingValue, projectId);
  await fsPromises.writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

export interface GeneratedProjectBundle {
  bundlePath: string;
  createdAt: string;
  sizeBytes: number;
  files: ProjectBundleFileRecord[];
}

interface CollectedBundleEntries {
  filePaths: string[];
  emptyDirectoryPaths: string[];
}

function toPosixRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function buildProjectIgnore(projectFolderPath: string) {
  const matcher = ignore();
  matcher.add(['.chatgpt', '.chatgpt/**']);

  const gitIgnorePath = path.join(projectFolderPath, '.gitignore');
  if (existsSync(gitIgnorePath)) {
    matcher.add(readFileSync(gitIgnorePath, 'utf8'));
  }

  return matcher;
}

function isIgnoredDirectory(matcher: ReturnType<typeof ignore>, relativePath: string): boolean {
  const normalized = toPosixRelativePath(relativePath);
  return Boolean(normalized) && (matcher.ignores(normalized) || matcher.ignores(`${normalized}/`));
}

function collectBundleFilePaths(
  projectFolderPath: string,
  matcher: ReturnType<typeof ignore>,
  relativePath = '',
): CollectedBundleEntries {
  const currentDirectoryPath = path.join(projectFolderPath, relativePath || '.');
  if (!existsSync(currentDirectoryPath) || !statSync(currentDirectoryPath).isDirectory()) {
    return { filePaths: [], emptyDirectoryPaths: [] };
  }

  const entries = readdirSync(currentDirectoryPath, { withFileTypes: true })
    .filter((entry) => entry.name !== '.' && entry.name !== '..')
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }));

  const filePaths: string[] = [];
  const emptyDirectoryPaths: string[] = [];
  for (const entry of entries) {
    const entryRelativePath = toPosixRelativePath(relativePath ? `${relativePath}/${entry.name}` : entry.name);
    if (!entryRelativePath) {
      continue;
    }

    if (matcher.ignores(entryRelativePath)) {
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (isIgnoredDirectory(matcher, entryRelativePath)) {
        continue;
      }

      const nestedEntries = collectBundleFilePaths(projectFolderPath, matcher, entryRelativePath);
      filePaths.push(...nestedEntries.filePaths);
      emptyDirectoryPaths.push(...nestedEntries.emptyDirectoryPaths);
      if (!nestedEntries.filePaths.length && !nestedEntries.emptyDirectoryPaths.length) {
        emptyDirectoryPaths.push(entryRelativePath);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    filePaths.push(entryRelativePath);
  }

  return { filePaths, emptyDirectoryPaths };
}

async function computeSha256(fullPath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(fullPath), hash);
  return hash.digest('hex');
}

function sanitizeBundleFileName(projectNameOrId: string): string {
  const sanitized = projectNameOrId
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
  return sanitized || 'project';
}

async function buildBundleFileRecords(projectFolderPath: string, relativePaths: string[]): Promise<ProjectBundleFileRecord[]> {
  const records: ProjectBundleFileRecord[] = [];

  for (const relativePath of relativePaths) {
    const fullPath = path.join(projectFolderPath, relativePath);
    const stats = await fsPromises.stat(fullPath);
    records.push({
      relativePath,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      sha256: await computeSha256(fullPath),
    });
  }

  return records;
}

async function writeProjectZip(
  projectFolderPath: string,
  bundlePath: string,
  relativePaths: string[],
  emptyDirectoryPaths: string[],
): Promise<void> {
  await fsPromises.mkdir(path.dirname(bundlePath), { recursive: true });
  await fsPromises.rm(bundlePath, { force: true });

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(bundlePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const abortWithError = (error: Error) => {
      output.destroy();
      reject(error);
    };

    output.on('close', () => resolve());
    output.on('error', (error) => reject(error));
    archive.on('warning', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      reject(error);
    });
    archive.on('error', abortWithError);
    archive.pipe(output);

    for (const relativePath of relativePaths) {
      archive.file(path.join(projectFolderPath, relativePath), { name: relativePath });
    }

    for (const relativePath of emptyDirectoryPaths) {
      archive.append('', { name: `${relativePath.replace(/\/+$/g, '')}/` });
    }

    void archive.finalize();
  });
}

export async function createProjectBundle(projectId: string, projectName: string, projectFolderPath: string): Promise<GeneratedProjectBundle> {
  await ensureRemoteManifest(projectFolderPath, projectId);

  const matcher = buildProjectIgnore(projectFolderPath);
  const collectedEntries = collectBundleFilePaths(projectFolderPath, matcher);
  const relativePaths = [...collectedEntries.filePaths];
  if (!relativePaths.includes(REMOTE_MANIFEST_FILE)) {
    relativePaths.push(REMOTE_MANIFEST_FILE);
  }
  relativePaths.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }));

  const fileRecords = await buildBundleFileRecords(projectFolderPath, relativePaths);
  const bundleDirectoryPath = path.join(projectFolderPath, META_DIRECTORY_NAME, BUNDLES_DIRECTORY_NAME);
  const bundlePath = path.join(bundleDirectoryPath, `${sanitizeBundleFileName(projectName || projectId)}-bundle.zip`);

  await writeProjectZip(projectFolderPath, bundlePath, relativePaths, collectedEntries.emptyDirectoryPaths);

  const stats = await fsPromises.stat(bundlePath);
  return {
    bundlePath,
    createdAt: new Date().toISOString(),
    sizeBytes: stats.size,
    files: fileRecords,
  };
}
