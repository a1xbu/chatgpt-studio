import { createReadStream, promises as fsPromises } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { ArchiveEntryComparisonStatus, ChatFileArchiveEntryRecord, ChatFileRecord, REMOTE_MANIFEST_FILE, RemoteManifest, RemoteManifestStatus } from '../shared/contracts';
import { applyDownloadedGitBundle, isDownloadedGitBundleFile } from './git-bundle';

const REMOTE_META_DIRECTORY = path.posix.dirname(REMOTE_MANIFEST_FILE);
const CRC32_TABLE = new Uint32Array(256);
const projectFileCrcCache = new Map<string, { sizeBytes: number; mtimeMs: number; crc32: number }>();

for (let index = 0; index < 256; index += 1) {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  CRC32_TABLE[index] = crc >>> 0;
}

interface FileSystemSignature {
  kind: 'missing' | 'file' | 'directory' | 'other';
  sizeBytes: number | null;
  crc32: number | null;
}

export interface InspectedArchiveResult {
  entries: ChatFileArchiveEntryRecord[];
  isProject: boolean;
  hasRemoteManifest: boolean;
  projectSummary: string | null;
  projectRootInArchive: string | null;
  remoteManifestProjectId: string | null;
  remoteManifestStatus: RemoteManifestStatus;
}


interface AppliedSandboxContentResult {
  appliedAt: string;
  updatedFileCount: number;
  message?: string | null;
  gitBundle?: ChatFileRecord['gitBundle'];
}


function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isZipPath(filePath: string | null | undefined): boolean {
  return typeof filePath === 'string' && filePath.trim().toLowerCase().endsWith('.zip');
}

function normalizeArchivePath(rawPath: string): string | null {
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '');
  if (!normalized || normalized === '.') {
    return null;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (!segments.length) {
    return null;
  }

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return segments.join('/');
}

function getArchiveDirectoryParents(entryPath: string): string[] {
  const segments = entryPath.split('/').filter(Boolean);
  const result: string[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    result.push(segments.slice(0, index).join('/'));
  }
  return result;
}

function isWithinArchiveRoot(entryPath: string, rootPath: string | null): boolean {
  if (!rootPath) {
    return true;
  }

  return entryPath === rootPath || entryPath.startsWith(`${rootPath}/`);
}

function toDisplayArchivePath(entryPath: string, rootPath: string | null): string | null {
  if (!isWithinArchiveRoot(entryPath, rootPath)) {
    return null;
  }

  const relativePath = rootPath ? path.posix.relative(rootPath, entryPath) : entryPath;
  const normalizedRelativePath = normalizeArchivePath(relativePath);
  if (!normalizedRelativePath) {
    return null;
  }

  if (normalizedRelativePath === REMOTE_META_DIRECTORY || normalizedRelativePath.startsWith(`${REMOTE_META_DIRECTORY}/`)) {
    return null;
  }

  return normalizedRelativePath;
}

function getEntrySize(entry: AdmZip.IZipEntry): number {
  const header = (entry as AdmZip.IZipEntry & { header?: { size?: number } }).header;
  const headerSize = typeof header?.size === 'number' && Number.isFinite(header.size) ? header.size : null;
  if (headerSize != null) {
    return Math.max(0, headerSize);
  }

  return Math.max(0, entry.getData().length);
}

function getEntryCrc32(entry: AdmZip.IZipEntry): number | null {
  const candidate = entry as AdmZip.IZipEntry & { header?: { crc?: number }; crc?: number };
  const rawCrc = typeof candidate.header?.crc === 'number' ? candidate.header.crc : typeof candidate.crc === 'number' ? candidate.crc : null;
  if (rawCrc == null || !Number.isFinite(rawCrc)) {
    return null;
  }

  return rawCrc >>> 0;
}

function updateCrc32(crc: number, chunk: Uint8Array): number {
  let next = crc >>> 0;
  for (const byte of chunk) {
    next = CRC32_TABLE[(next ^ byte) & 0xff]! ^ (next >>> 8);
  }
  return next >>> 0;
}

async function computeFileCrc32(filePath: string, sizeBytes: number, mtimeMs: number): Promise<number> {
  const normalizedPath = path.resolve(filePath);
  const cached = projectFileCrcCache.get(normalizedPath);
  if (cached && cached.sizeBytes === sizeBytes && cached.mtimeMs === mtimeMs) {
    return cached.crc32;
  }

  const crc32 = await new Promise<number>((resolve, reject) => {
    let crc = 0xffffffff;
    const stream = createReadStream(normalizedPath);
    stream.on('data', (chunk: Buffer | string) => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      crc = updateCrc32(crc, bytes);
    });
    stream.once('error', reject);
    stream.once('end', () => {
      resolve((crc ^ 0xffffffff) >>> 0);
    });
  });

  projectFileCrcCache.set(normalizedPath, {
    sizeBytes,
    mtimeMs,
    crc32,
  });

  return crc32;
}

function getArchivePathDepth(relativePath: string): number {
  return relativePath.split('/').filter(Boolean).length;
}

function normalizeComparisonStatus(status: ArchiveEntryComparisonStatus | null | undefined): ArchiveEntryComparisonStatus {
  return status === 'new' || status === 'modified' ? status : 'unchanged';
}

function collectSafeZipEntries(zipFilePath: string): {
  zip: AdmZip;
  fileEntries: Array<{ entry: AdmZip.IZipEntry; fullPath: string }>;
  explicitDirectories: string[];
} {
  const zip = new AdmZip(zipFilePath);
  const fileEntries: Array<{ entry: AdmZip.IZipEntry; fullPath: string }> = [];
  const explicitDirectories: string[] = [];

  for (const entry of zip.getEntries()) {
    const normalizedPath = normalizeArchivePath(entry.entryName);
    if (!normalizedPath) {
      continue;
    }

    if (entry.isDirectory) {
      explicitDirectories.push(normalizedPath);
      continue;
    }

    fileEntries.push({ entry, fullPath: normalizedPath });
  }

  explicitDirectories.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }));
  fileEntries.sort((left, right) => left.fullPath.localeCompare(right.fullPath, undefined, { sensitivity: 'base', numeric: true }));
  return { zip, fileEntries, explicitDirectories };
}

type ParsedManifestCandidate = {
  manifest: RemoteManifest | null;
  projectId: string | null;
  status: RemoteManifestStatus;
};

function parseManifestCandidate(rawManifest: string, expectedProjectId: string): ParsedManifestCandidate {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawManifest);
  } catch {
    return { manifest: null, projectId: null, status: 'invalid' };
  }

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    return { manifest: null, projectId: null, status: 'invalid' };
  }

  const candidate = parsedValue as Record<string, unknown>;
  const projectId = normalizeText(candidate.project_id);
  const summary = normalizeText(candidate.summary) || undefined;
  const projectRootInArchive = normalizeText(candidate.project_root_in_archive) || undefined;

  if (!projectId) {
    return { manifest: null, projectId: null, status: 'invalid' };
  }

  if (projectRootInArchive && !normalizeArchivePath(projectRootInArchive)) {
    return { manifest: null, projectId, status: 'invalid' };
  }

  if (projectId !== expectedProjectId) {
    return { manifest: null, projectId, status: 'mismatched' };
  }

  return {
    manifest: {
      project_id: projectId,
      summary,
      project_root_in_archive: projectRootInArchive,
    },
    projectId,
    status: 'matched',
  };
}

function collectManifestCandidatePaths(fileEntries: Array<{ entry: AdmZip.IZipEntry; fullPath: string }>): string[] {
  const candidateEntries = new Set(fileEntries.map((item) => item.fullPath));
  const rootDirectorySet = new Set(
    fileEntries
      .map(({ fullPath }) => fullPath.split('/')[0] ?? '')
      .filter(Boolean),
  );

  const manifestCandidatePaths: string[] = [];
  if (candidateEntries.has(REMOTE_MANIFEST_FILE)) {
    manifestCandidatePaths.push(REMOTE_MANIFEST_FILE);
  }

  if (rootDirectorySet.size <= 10) {
    for (const directory of [...rootDirectorySet].sort((left, right) => left.localeCompare(right))) {
      const nestedManifestPath = `${directory}/${REMOTE_MANIFEST_FILE}`;
      if (candidateEntries.has(nestedManifestPath)) {
        manifestCandidatePaths.push(nestedManifestPath);
      }
    }
  }

  return manifestCandidatePaths;
}

function resolveProjectManifest(
  fileEntries: Array<{ entry: AdmZip.IZipEntry; fullPath: string }>,
  expectedProjectId: string,
): { manifest: RemoteManifest | null; manifestPath: string | null; hasRemoteManifest: boolean; projectId: string | null; status: RemoteManifestStatus } {
  const candidateEntries = new Map(fileEntries.map((item) => [item.fullPath, item]));
  const manifestCandidatePaths = collectManifestCandidatePaths(fileEntries);

  for (const candidatePath of manifestCandidatePaths) {
    const candidateEntry = candidateEntries.get(candidatePath);
    if (!candidateEntry) {
      continue;
    }

    const parsed = parseManifestCandidate(candidateEntry.entry.getData().toString('utf8'), expectedProjectId);
    return {
      manifest: parsed.manifest,
      manifestPath: parsed.status === 'matched' ? candidatePath : null,
      hasRemoteManifest: true,
      projectId: parsed.projectId,
      status: parsed.status,
    };
  }

  return {
    manifest: null,
    manifestPath: null,
    hasRemoteManifest: false,
    projectId: null,
    status: 'missing',
  };
}
function buildDisplayedArchiveEntries(
  fileEntries: Array<{ entry: AdmZip.IZipEntry; fullPath: string }>,
  explicitDirectories: string[],
  rootPath: string | null,
): ChatFileArchiveEntryRecord[] {
  const directoryPaths = new Set<string>();
  for (const directoryPath of explicitDirectories) {
    const displayedDirectoryPath = toDisplayArchivePath(directoryPath, rootPath);
    if (displayedDirectoryPath) {
      directoryPaths.add(displayedDirectoryPath);
    }
  }

  const fileRecords = new Map<string, { sizeBytes: number; crc32: number | null }>();
  for (const { entry, fullPath } of fileEntries) {
    const displayedFilePath = toDisplayArchivePath(fullPath, rootPath);
    if (!displayedFilePath) {
      continue;
    }

    fileRecords.set(displayedFilePath, { sizeBytes: getEntrySize(entry), crc32: getEntryCrc32(entry) });
    for (const parentPath of getArchiveDirectoryParents(displayedFilePath)) {
      directoryPaths.add(parentPath);
    }
  }

  const entries: ChatFileArchiveEntryRecord[] = [
    ...[...directoryPaths]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }))
      .map((relativePath) => ({
        relativePath,
        kind: 'directory' as const,
        sizeBytes: 0,
        crc32: null,
      })),
    ...[...fileRecords.entries()]
      .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }))
      .map(([relativePath, metadata]) => ({
        relativePath,
        kind: 'file' as const,
        sizeBytes: metadata.sizeBytes,
        crc32: metadata.crc32,
      })),
  ];

  return entries;
}

export async function inspectDownloadedArchive(zipFilePath: string, expectedProjectId: string): Promise<InspectedArchiveResult> {
  const normalizedProjectId = normalizeText(expectedProjectId);
  if (!normalizedProjectId) {
    throw new Error('Expected project id is empty.');
  }

  const { fileEntries, explicitDirectories } = collectSafeZipEntries(zipFilePath);
  const manifestResolution = resolveProjectManifest(fileEntries, normalizedProjectId);
  const manifestMatch = manifestResolution.manifest && manifestResolution.manifestPath
    ? manifestResolution
    : null;
  const manifestBaseRoot = manifestMatch && manifestMatch.manifestPath
    ? normalizeArchivePath(path.posix.dirname(path.posix.dirname(manifestMatch.manifestPath)))
    : null;
  const projectRootInArchive = manifestMatch?.manifest?.project_root_in_archive
    ? normalizeArchivePath(manifestMatch.manifest.project_root_in_archive)
    : manifestBaseRoot;

  return {
    entries: buildDisplayedArchiveEntries(fileEntries, explicitDirectories, projectRootInArchive),
    isProject: Boolean(manifestMatch?.manifest),
    hasRemoteManifest: manifestResolution.hasRemoteManifest,
    projectSummary: manifestMatch?.manifest?.summary ?? null,
    projectRootInArchive: projectRootInArchive ?? null,
    remoteManifestProjectId: manifestResolution.projectId,
    remoteManifestStatus: manifestResolution.status,
  };
}

async function writeArchiveFile(targetPath: string, bytes: Buffer): Promise<void> {
  const normalizedTargetPath = path.resolve(targetPath);
  await fsPromises.mkdir(path.dirname(normalizedTargetPath), { recursive: true });
  await fsPromises.writeFile(normalizedTargetPath, bytes);
}

function resolveSafeProjectPath(projectFolderPath: string, relativePath: string): string {
  const normalizedRelativePath = relativePath.split('/').filter(Boolean).join(path.sep);
  const targetPath = path.resolve(projectFolderPath, normalizedRelativePath);
  const relative = path.relative(projectFolderPath, targetPath).replace(/\\/g, '/');
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Archive entry escapes the project folder: ${relativePath}`);
  }

  return targetPath;
}

async function getFileSystemSignature(fullPath: string): Promise<FileSystemSignature> {
  try {
    const stats = await fsPromises.stat(fullPath);
    if (stats.isDirectory()) {
      return {
        kind: 'directory',
        sizeBytes: 0,
        crc32: null,
      };
    }

    if (!stats.isFile()) {
      return {
        kind: 'other',
        sizeBytes: null,
        crc32: null,
      };
    }

    return {
      kind: 'file',
      sizeBytes: stats.size,
      crc32: await computeFileCrc32(fullPath, stats.size, stats.mtimeMs),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {
        kind: 'missing',
        sizeBytes: null,
        crc32: null,
      };
    }
    throw error;
  }
}

export async function compareArchiveEntriesAgainstProject(
  projectFolderPath: string,
  entries: ChatFileArchiveEntryRecord[],
): Promise<ChatFileArchiveEntryRecord[]> {
  const fileStatuses = new Map<string, ArchiveEntryComparisonStatus>();
  const directoryStatuses = new Map<string, ArchiveEntryComparisonStatus>();
  const changedDirectoryPaths = new Set<string>();

  const fileEntries = entries.filter((entry) => entry.kind === 'file');
  await Promise.all(
    fileEntries.map(async (entry) => {
      const targetPath = resolveSafeProjectPath(projectFolderPath, entry.relativePath);
      const targetSignature = await getFileSystemSignature(targetPath);
      let comparisonStatus: ArchiveEntryComparisonStatus = 'unchanged';
      if (targetSignature.kind === 'missing') {
        comparisonStatus = 'new';
      } else if (targetSignature.kind !== 'file') {
        comparisonStatus = 'modified';
      } else if (targetSignature.sizeBytes !== entry.sizeBytes) {
        comparisonStatus = 'modified';
      } else if (entry.crc32 != null && targetSignature.crc32 != null && (entry.crc32 >>> 0) !== (targetSignature.crc32 >>> 0)) {
        comparisonStatus = 'modified';
      }

      fileStatuses.set(entry.relativePath, comparisonStatus);
      if (comparisonStatus !== 'unchanged') {
        for (const parentPath of getArchiveDirectoryParents(entry.relativePath)) {
          changedDirectoryPaths.add(parentPath);
        }
      }
    }),
  );

  const directoryEntries = entries
    .filter((entry) => entry.kind === 'directory')
    .sort((left, right) => getArchivePathDepth(left.relativePath) - getArchivePathDepth(right.relativePath));

  await Promise.all(
    directoryEntries.map(async (entry) => {
      const targetPath = resolveSafeProjectPath(projectFolderPath, entry.relativePath);
      const targetSignature = await getFileSystemSignature(targetPath);
      let comparisonStatus: ArchiveEntryComparisonStatus = 'unchanged';
      if (targetSignature.kind === 'missing') {
        comparisonStatus = 'new';
      } else if (targetSignature.kind !== 'directory') {
        comparisonStatus = 'modified';
      } else if (changedDirectoryPaths.has(entry.relativePath)) {
        comparisonStatus = 'modified';
      }
      directoryStatuses.set(entry.relativePath, comparisonStatus);
    }),
  );

  return entries.map((entry) => {
    const comparisonStatus = entry.kind === 'directory'
      ? normalizeComparisonStatus(directoryStatuses.get(entry.relativePath))
      : normalizeComparisonStatus(fileStatuses.get(entry.relativePath));
    return {
      ...entry,
      comparisonStatus,
    };
  });
}

async function fileBytesEqual(targetPath: string, nextBytes: Buffer): Promise<boolean> {
  try {
    const targetStats = await fsPromises.stat(targetPath);
    if (!targetStats.isFile() || targetStats.size !== nextBytes.length) {
      return false;
    }

    const existingBytes = await fsPromises.readFile(targetPath);
    return existingBytes.equals(nextBytes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return false;
    }
    return false;
  }
}

async function writeArchiveFileIfChanged(targetPath: string, bytes: Buffer): Promise<boolean> {
  if (await fileBytesEqual(targetPath, bytes)) {
    return false;
  }

  await writeArchiveFile(targetPath, bytes);
  return true;
}

async function applyArchiveToProject(
  projectFolderPath: string,
  zipFilePath: string,
  rootPath: string | null,
  selectedRelativePath?: string | null,
): Promise<number> {
  const { zip, fileEntries, explicitDirectories } = collectSafeZipEntries(zipFilePath);
  void zip;
  const normalizedSelectedPath = selectedRelativePath ? normalizeArchivePath(selectedRelativePath) : null;

  const extractedDirectories = new Set<string>();
  for (const directoryPath of explicitDirectories) {
    const displayedDirectoryPath = toDisplayArchivePath(directoryPath, rootPath);
    if (!displayedDirectoryPath) {
      continue;
    }

    if (normalizedSelectedPath && displayedDirectoryPath !== normalizedSelectedPath && !displayedDirectoryPath.startsWith(`${normalizedSelectedPath}/`)) {
      continue;
    }

    const targetDirectoryPath = resolveSafeProjectPath(projectFolderPath, displayedDirectoryPath);
    await fsPromises.mkdir(targetDirectoryPath, { recursive: true });
    extractedDirectories.add(displayedDirectoryPath);
  }

  let updatedFileCount = 0;
  for (const { entry, fullPath } of fileEntries) {
    const displayedFilePath = toDisplayArchivePath(fullPath, rootPath);
    if (!displayedFilePath) {
      continue;
    }

    if (normalizedSelectedPath && displayedFilePath !== normalizedSelectedPath && !displayedFilePath.startsWith(`${normalizedSelectedPath}/`)) {
      continue;
    }

    for (const parentPath of getArchiveDirectoryParents(displayedFilePath)) {
      if (!extractedDirectories.has(parentPath)) {
        await fsPromises.mkdir(resolveSafeProjectPath(projectFolderPath, parentPath), { recursive: true });
        extractedDirectories.add(parentPath);
      }
    }

    const targetPath = resolveSafeProjectPath(projectFolderPath, displayedFilePath);
    if (await writeArchiveFileIfChanged(targetPath, entry.getData())) {
      updatedFileCount += 1;
    }
  }

  return updatedFileCount;
}

async function applyRegularFileToProject(projectFolderPath: string, downloadedFilePath: string, fileName: string | null): Promise<number> {
  const safeFileName = path.basename(normalizeText(fileName) || path.basename(downloadedFilePath));
  const targetPath = resolveSafeProjectPath(projectFolderPath, safeFileName);
  await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
  const sourceBytes = await fsPromises.readFile(downloadedFilePath);
  return (await writeArchiveFileIfChanged(targetPath, sourceBytes)) ? 1 : 0;
}

export async function applyDownloadedSandboxFile(
  projectFolderPath: string,
  file: Pick<ChatFileRecord, 'downloadPath' | 'fileName' | 'projectRootInArchive' | 'gitBundle' | 'chatId'>,
  selectedRelativePath?: string | null,
): Promise<AppliedSandboxContentResult> {
  const downloadedFilePath = normalizeText(file.downloadPath);
  if (!downloadedFilePath) {
    throw new Error('Download the file before applying it to the project.');
  }

  let updatedFileCount = 0;
  let message: string | null = null;
  let gitBundle: ChatFileRecord['gitBundle'] = file.gitBundle ?? null;
  if (isZipPath(downloadedFilePath)) {
    updatedFileCount = await applyArchiveToProject(projectFolderPath, downloadedFilePath, normalizeArchivePath(file.projectRootInArchive ?? ''), selectedRelativePath ?? null);
  } else if (isDownloadedGitBundleFile({ downloadPath: downloadedFilePath, fileName: file.fileName ?? null, sandboxPath: file.fileName ?? null })) {
    if (selectedRelativePath) {
      throw new Error('Selecting nested entries is only supported for ZIP archives.');
    }
    const result = await applyDownloadedGitBundle(projectFolderPath, file);
    message = result.message;
    gitBundle = {
      ...(file.gitBundle ?? { branches: [], latestBranch: null, message: null, inspectedAt: result.appliedAt }),
      status: 'applied',
      latestBranch: result.branch,
      branches: (file.gitBundle?.branches?.length ? file.gitBundle.branches.map((branch) => branch.commitHash === result.branch.commitHash && branch.branchName === result.branch.branchName ? result.branch : branch) : [result.branch]),
      message: result.message,
      inspectedAt: result.appliedAt,
    };
  } else {
    if (selectedRelativePath) {
      throw new Error('Selecting nested entries is only supported for ZIP archives.');
    }
    updatedFileCount = await applyRegularFileToProject(projectFolderPath, downloadedFilePath, file.fileName ?? null);
  }

  return {
    appliedAt: new Date().toISOString(),
    updatedFileCount,
    message,
    gitBundle,
  };
}

export function isDownloadedZipFile(file: Pick<ChatFileRecord, 'downloadPath' | 'sandboxPath' | 'fileName'>): boolean {
  const candidatePath = normalizeText(file.downloadPath) || normalizeText(file.fileName) || normalizeText(file.sandboxPath);
  return isZipPath(candidatePath);
}
