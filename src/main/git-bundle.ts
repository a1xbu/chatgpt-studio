import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ChatFileRecord, GitBundleBranchRecord, GitBundleInspection } from '../shared/contracts';

const execFileAsync = promisify(execFile);

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isBundlePath(filePath: string | null | undefined): boolean {
  const normalized = normalizeText(filePath).toLowerCase();
  return normalized.endsWith('.bundle') || normalized.endsWith('.gitbundle');
}

export function isDownloadedGitBundleFile(file: Pick<ChatFileRecord, 'downloadPath' | 'sandboxPath' | 'fileName'>): boolean {
  const candidatePath = normalizeText(file.downloadPath) || normalizeText(file.fileName) || normalizeText(file.sandboxPath);
  return isBundlePath(candidatePath);
}

function gitBundleErrorMessage(error: unknown): string {
  const candidate = error as { stderr?: unknown; stdout?: unknown; message?: unknown };
  const stderr = normalizeText(candidate?.stderr);
  const stdout = normalizeText(candidate?.stdout);
  const message = normalizeText(candidate?.message);
  return stderr || stdout || message || String(error);
}

async function runGit(repoRootPath: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd: repoRootPath,
    maxBuffer: 1024 * 1024 * 8,
  });
  return `${result.stdout ?? ''}`.trim();
}

async function tryRunGit(repoRootPath: string, args: string[]): Promise<{ ok: true; stdout: string } | { ok: false; message: string }> {
  try {
    return { ok: true, stdout: await runGit(repoRootPath, args) };
  } catch (error) {
    return { ok: false, message: gitBundleErrorMessage(error) };
  }
}

function createRemoteName(prefix: string, seed: string): string {
  const hash = createHash('sha1').update(seed).digest('hex').slice(0, 12);
  return `${prefix}-${hash}`;
}

function parseBranchLine(line: string): GitBundleBranchRecord | null {
  const [branchName, commitHash, committedAt, authorName, subject] = line.split('\x1f');
  if (!branchName || !commitHash) {
    return null;
  }

  return {
    branchName,
    localBranchName: null,
    commitHash,
    shortHash: commitHash.slice(0, 7),
    subject: subject ?? '',
    authorName: authorName || null,
    committedAt: committedAt || null,
    relation: 'unknown',
  };
}

function compareBranchesByDate(left: GitBundleBranchRecord, right: GitBundleBranchRecord): number {
  const rightTime = right.committedAt ? Date.parse(right.committedAt) : Number.NaN;
  const leftTime = left.committedAt ? Date.parse(left.committedAt) : Number.NaN;
  if (!Number.isNaN(rightTime) && !Number.isNaN(leftTime) && rightTime !== leftTime) {
    return rightTime - leftTime;
  }
  if (!Number.isNaN(rightTime)) {
    return 1;
  }
  if (!Number.isNaN(leftTime)) {
    return -1;
  }
  return right.commitHash.localeCompare(left.commitHash);
}

async function removeRemoteIfPresent(repoRootPath: string, remoteName: string): Promise<void> {
  const remotes = await tryRunGit(repoRootPath, ['remote']);
  if (remotes.ok && remotes.stdout.split('\n').map((line) => line.trim()).includes(remoteName)) {
    await tryRunGit(repoRootPath, ['remote', 'remove', remoteName]);
  }
}

async function fetchBundleRemote(repoRootPath: string, bundlePath: string, remoteName: string): Promise<void> {
  await removeRemoteIfPresent(repoRootPath, remoteName);
  await runGit(repoRootPath, ['remote', 'add', remoteName, bundlePath]);
  const branchFetch = await tryRunGit(repoRootPath, ['fetch', '--prune', remoteName, '+refs/heads/*:refs/remotes/' + remoteName + '/*']);
  if (branchFetch.ok) {
    return;
  }

  const headFetch = await tryRunGit(repoRootPath, ['fetch', '--prune', remoteName, '+HEAD:refs/remotes/' + remoteName + '/__bundle_HEAD']);
  if (headFetch.ok) {
    return;
  }

  throw new Error(branchFetch.message || headFetch.message || 'Git could not fetch branch refs from the bundle.');
}

async function listRemoteBranches(repoRootPath: string, remoteName: string): Promise<GitBundleBranchRecord[]> {
  const output = await runGit(repoRootPath, [
    'for-each-ref',
    '--format=%(refname:strip=3)%1f%(objectname)%1f%(committerdate:iso-strict)%1f%(authorname)%1f%(subject)',
    `refs/remotes/${remoteName}`,
  ]);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseBranchLine)
    .filter((entry): entry is GitBundleBranchRecord => Boolean(entry))
    .sort(compareBranchesByDate);
}

async function listLocalBranchHashes(repoRootPath: string): Promise<string[]> {
  const output = await runGit(repoRootPath, ['for-each-ref', '--format=%(objectname)', 'refs/heads']);
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function hasMergeBaseWithLocalBranch(repoRootPath: string, commitHash: string, localBranchHashes: readonly string[]): Promise<boolean> {
  for (const localHash of localBranchHashes) {
    const mergeBase = await tryRunGit(repoRootPath, ['merge-base', commitHash, localHash]);
    if (mergeBase.ok && mergeBase.stdout.trim()) {
      return true;
    }
  }
  return false;
}

async function annotateBranchRelations(repoRootPath: string, branches: GitBundleBranchRecord[]): Promise<GitBundleBranchRecord[]> {
  const localBranchHashes = await listLocalBranchHashes(repoRootPath);
  const result: GitBundleBranchRecord[] = [];
  for (const branch of branches) {
    result.push({
      ...branch,
      relation: await hasMergeBaseWithLocalBranch(repoRootPath, branch.commitHash, localBranchHashes) ? 'related' : 'unrelated',
    });
  }
  return result;
}

function buildInspection(status: GitBundleInspection['status'], overrides: Partial<GitBundleInspection> = {}): GitBundleInspection {
  return {
    status,
    branches: [],
    latestBranch: null,
    message: null,
    inspectedAt: new Date().toISOString(),
    ...overrides,
  };
}

export async function inspectDownloadedGitBundle(repoRootPath: string, bundlePath: string): Promise<GitBundleInspection> {
  const normalizedBundlePath = normalizeText(bundlePath);
  if (!normalizedBundlePath || !isBundlePath(normalizedBundlePath)) {
    return buildInspection('invalid', { message: 'The downloaded file is not a Git bundle.' });
  }

  const verifyResult = await tryRunGit(repoRootPath, ['bundle', 'verify', normalizedBundlePath]);
  if (!verifyResult.ok) {
    return buildInspection('unrelated', {
      message: verifyResult.message || 'Git could not verify this bundle against the current repository.',
    });
  }

  const remoteName = createRemoteName('chatgpt-inspect', normalizedBundlePath);
  try {
    await fetchBundleRemote(repoRootPath, normalizedBundlePath, remoteName);
    const fetchedBranches = await listRemoteBranches(repoRootPath, remoteName);
    if (!fetchedBranches.length) {
      return buildInspection('invalid', { message: 'The Git bundle does not contain any branch refs.' });
    }

    const branches = await annotateBranchRelations(repoRootPath, fetchedBranches);
    const latestBranch = branches[0] ?? null;
    const hasRelatedBranch = branches.some((branch) => branch.relation === 'related');
    const status: GitBundleInspection['status'] = hasRelatedBranch ? 'ready' : 'unrelated';
    return buildInspection(status, {
      branches,
      latestBranch,
      message: hasRelatedBranch
        ? 'Ready to fetch into a new local branch.'
        : 'No shared history with local branches was found.',
    });
  } catch (error) {
    return buildInspection('error', { message: gitBundleErrorMessage(error) });
  } finally {
    await removeRemoteIfPresent(repoRootPath, remoteName);
  }
}

function sanitizeBranchName(rawBranchName: string, commitHash: string): string {
  const cleaned = rawBranchName
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^\.+/, '').replace(/\.+$/, ''))
    .filter(Boolean)
    .join('/')
    .replace(/\.\./g, '.')
    .replace(/@\{/g, '-');
  return cleaned ? `chatgpt/${cleaned}` : `chatgpt/bundle-${commitHash.slice(0, 12)}`;
}

async function branchExists(repoRootPath: string, branchName: string): Promise<boolean> {
  const result = await tryRunGit(repoRootPath, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
  return result.ok;
}

async function getBranchHash(repoRootPath: string, branchName: string): Promise<string | null> {
  const result = await tryRunGit(repoRootPath, ['rev-parse', '--verify', `refs/heads/${branchName}`]);
  return result.ok ? result.stdout.trim() || null : null;
}

async function resolveAvailableLocalBranchName(repoRootPath: string, preferredBranchName: string, commitHash: string): Promise<string> {
  let candidate = preferredBranchName;
  const existingHash = await getBranchHash(repoRootPath, candidate);
  if (!existingHash) {
    return candidate;
  }
  if (existingHash === commitHash) {
    return candidate;
  }

  const shortHash = commitHash.slice(0, 12);
  candidate = `${preferredBranchName}-${shortHash}`;
  if (!(await branchExists(repoRootPath, candidate))) {
    return candidate;
  }

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const suffixed = `${preferredBranchName}-${shortHash}-${suffix}`;
    if (!(await branchExists(repoRootPath, suffixed))) {
      return suffixed;
    }
  }

  throw new Error(`Could not find an available local branch name for ${preferredBranchName}.`);
}

export type ApplyGitBundleResult = {
  appliedAt: string;
  localBranchName: string;
  branch: GitBundleBranchRecord;
  message: string;
};

export async function applyDownloadedGitBundle(repoRootPath: string, file: Pick<ChatFileRecord, 'downloadPath' | 'gitBundle' | 'chatId'>): Promise<ApplyGitBundleResult> {
  const bundlePath = normalizeText(file.downloadPath);
  if (!bundlePath || !isBundlePath(bundlePath)) {
    throw new Error('Download a Git bundle before applying it.');
  }

  const remoteName = createRemoteName('chatgpt-' + (normalizeText(file.chatId).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 32) || 'bundle'), bundlePath);
  try {
    await fetchBundleRemote(repoRootPath, bundlePath, remoteName);
    const branches = await annotateBranchRelations(repoRootPath, await listRemoteBranches(repoRootPath, remoteName));
    if (!branches.length) {
      throw new Error('The Git bundle does not contain any branch refs.');
    }

    const requestedCommitHash = file.gitBundle?.latestBranch?.commitHash ?? null;
    const requestedBranchName = file.gitBundle?.latestBranch?.branchName ?? null;
    const selectedBranch = branches.find((branch) => branch.commitHash === requestedCommitHash && branch.branchName === requestedBranchName)
      ?? branches.find((branch) => branch.relation === 'related')
      ?? branches[0];

    if (!selectedBranch) {
      throw new Error('Could not select a branch from the Git bundle.');
    }
    if (selectedBranch.relation !== 'related') {
      throw new Error('This Git bundle does not appear to share history with the current repository.');
    }

    const preferredLocalBranchName = sanitizeBranchName(selectedBranch.branchName, selectedBranch.commitHash);
    const localBranchName = await resolveAvailableLocalBranchName(repoRootPath, preferredLocalBranchName, selectedBranch.commitHash);
    const existingHash = await getBranchHash(repoRootPath, localBranchName);
    if (existingHash !== selectedBranch.commitHash) {
      await runGit(repoRootPath, ['branch', localBranchName, `refs/remotes/${remoteName}/${selectedBranch.branchName}`]);
    }

    return {
      appliedAt: new Date().toISOString(),
      localBranchName,
      branch: {
        ...selectedBranch,
        localBranchName,
      },
      message: `Fetched ${selectedBranch.branchName} into local branch ${localBranchName}.`,
    };
  } finally {
    await removeRemoteIfPresent(repoRootPath, remoteName);
  }
}
