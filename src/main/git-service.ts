import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  GitBranchRecord,
  GitCommitDetails,
  GitCommitDetailsResult,
  GitCommitFileRecord,
  GitCommitRecord,
  GitOverviewResult,
  GitRepositoryOverview,
  GitStatusSummary,
} from '../shared/contracts';

const GIT_COMMAND_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const GIT_COMMIT_LIMIT = 120;

function normalizeGitText(value: string): string {
  return value.replace(/\r/g, '').trim();
}

function parseUpstreamTrack(value: string): { aheadBy: number; behindBy: number } {
  const normalized = normalizeGitText(value);
  if (!normalized || normalized === '[gone]') {
    return { aheadBy: 0, behindBy: 0 };
  }

  const aheadMatch = normalized.match(/ahead\s+(\d+)/i);
  const behindMatch = normalized.match(/behind\s+(\d+)/i);
  return {
    aheadBy: aheadMatch ? Number(aheadMatch[1]) || 0 : 0,
    behindBy: behindMatch ? Number(behindMatch[1]) || 0 : 0,
  };
}

function parseGitStatus(stdout: string): GitStatusSummary {
  const lines = stdout
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  let conflicted = 0;

  for (const line of lines) {
    const x = line[0] ?? ' ';
    const y = line[1] ?? ' ';

    if (x === '?' && y === '?') {
      untracked += 1;
      continue;
    }

    if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
      conflicted += 1;
    }

    if (x !== ' ') {
      staged += 1;
    }

    if (y !== ' ') {
      unstaged += 1;
    }
  }

  return {
    staged,
    unstaged,
    untracked,
    conflicted,
  };
}

function parseBranches(stdout: string): GitBranchRecord[] {
  const lines = stdout
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const branches = lines.map((line) => {
    const [name = '', headMarker = '', upstream = '', upstreamTrack = '', shortHash = '', commitHash = ''] = line.split('\0');
    const { aheadBy, behindBy } = parseUpstreamTrack(upstreamTrack);

    return {
      name,
      isCurrent: headMarker.trim() === '*',
      upstream: normalizeGitText(upstream) || null,
      aheadBy,
      behindBy,
      shortHash: normalizeGitText(shortHash) || null,
      commitHash: normalizeGitText(commitHash) || null,
    } satisfies GitBranchRecord;
  });

  branches.sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  });

  return branches;
}

function parseDecorations(value: string): string[] {
  return normalizeGitText(value)
    .split(',')
    .map((item) => normalizeGitText(item))
    .filter(Boolean);
}

function parseParentHashes(value: string): string[] {
  return normalizeGitText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCommits(stdout: string): GitCommitRecord[] {
  return stdout
    .split('\x01')
    .map((chunk) => chunk.replace(/\r/g, '').trim())
    .filter(Boolean)
    .map((chunk) => {
      const [hash = '', shortHash = '', authorName = '', authoredAt = '', subject = '', decorations = '', parentHashes = ''] = chunk.split('\0');
      return {
        hash,
        shortHash,
        authorName,
        authoredAt,
        subject,
        refs: parseDecorations(decorations),
        parentHashes: parseParentHashes(parentHashes),
      } satisfies GitCommitRecord;
    });
}

function parseCommitFiles(stdout: string): GitCommitFileRecord[] {
  return stdout
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = normalizeGitText(parts[0] ?? '');
      const normalizedStatus = status[0] || 'M';
      if (normalizedStatus === 'R' || normalizedStatus === 'C') {
        return {
          status: normalizedStatus,
          oldPath: normalizeGitText(parts[1] ?? '') || null,
          path: normalizeGitText(parts[2] ?? parts[1] ?? ''),
        } satisfies GitCommitFileRecord;
      }

      return {
        status: normalizedStatus,
        path: normalizeGitText(parts[1] ?? ''),
        oldPath: null,
      } satisfies GitCommitFileRecord;
    })
    .filter((entry) => Boolean(entry.path));
}

function runGit(folderPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', folderPath, ...args],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: GIT_COMMAND_TIMEOUT_MS,
        maxBuffer: GIT_MAX_BUFFER_BYTES,
      },
      (error, stdout, stderr) => {
        if (error) {
          const errorMessage = normalizeGitText(stderr) || normalizeGitText(error.message) || 'Git command failed.';
          reject(new Error(errorMessage));
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });
}

async function loadGitOverview(folderPath: string, selectedRefName?: string | null): Promise<GitRepositoryOverview> {
  const repoRootPath = normalizeGitText((await runGit(folderPath, ['rev-parse', '--show-toplevel'])).stdout);
  const statusSummary = parseGitStatus((await runGit(folderPath, ['status', '--porcelain=v1'])).stdout);
  const branches = parseBranches(
    (
      await runGit(folderPath, [
        'branch',
        '--list',
        '--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(upstream:track)%00%(objectname:short)%00%(objectname)',
      ])
    ).stdout,
  );

  const currentBranch = branches.find((branch) => branch.isCurrent) ?? null;
  const resolvedRefName = normalizeGitText(selectedRefName ?? '') || currentBranch?.name || 'HEAD';
  const logArgs = branches.length
    ? [
        'log',
        '--branches',
        `--max-count=${String(GIT_COMMIT_LIMIT)}`,
        '--date=iso-strict',
        '--decorate=short',
        '--date-order',
        '--pretty=format:%H%x00%h%x00%an%x00%aI%x00%s%x00%D%x00%P%x01',
      ]
    : [
        'log',
        resolvedRefName,
        `--max-count=${String(GIT_COMMIT_LIMIT)}`,
        '--date=iso-strict',
        '--decorate=short',
        '--date-order',
        '--pretty=format:%H%x00%h%x00%an%x00%aI%x00%s%x00%D%x00%P%x01',
      ];

  const commits = parseCommits((await runGit(folderPath, logArgs)).stdout)
    .map((commit, index) => ({ commit, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.commit.authoredAt);
      const rightTime = Date.parse(right.commit.authoredAt);
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      if (Number.isFinite(rightTime) && !Number.isFinite(leftTime)) {
        return 1;
      }
      if (Number.isFinite(leftTime) && !Number.isFinite(rightTime)) {
        return -1;
      }
      return left.index - right.index;
    })
    .map(({ commit }) => commit);

  return {
    repoRootPath,
    currentBranch,
    selectedRefName: resolvedRefName,
    statusSummary,
    branches,
    commits,
  };
}

async function loadCommitDetails(folderPath: string, commitHash: string): Promise<GitCommitDetails> {
  const normalizedCommitHash = normalizeGitText(commitHash);
  const files = parseCommitFiles(
    (
      await runGit(folderPath, [
        'show',
        '--format=',
        '--name-status',
        '--find-renames',
        '--find-copies',
        '--root',
        normalizedCommitHash,
      ])
    ).stdout,
  );

  return {
    commitHash: normalizedCommitHash,
    files,
  };
}

export class GitService {
  public async getOverview(folderPath: string, selectedRefName?: string | null): Promise<GitOverviewResult> {
    const normalizedFolderPath = typeof folderPath === 'string' ? folderPath.trim() : '';
    if (!normalizedFolderPath) {
      return {
        kind: 'missing',
      };
    }

    const dotGitPath = path.join(normalizedFolderPath, '.git');
    if (!existsSync(dotGitPath)) {
      return {
        kind: 'missing',
      };
    }

    try {
      const overview = await loadGitOverview(normalizedFolderPath, selectedRefName);
      return {
        kind: 'ready',
        overview,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        kind: 'error',
        errorMessage: message,
      };
    }
  }

  public async getCommitDetails(folderPath: string, commitHash: string): Promise<GitCommitDetailsResult> {
    const normalizedFolderPath = typeof folderPath === 'string' ? folderPath.trim() : '';
    const normalizedCommitHash = typeof commitHash === 'string' ? commitHash.trim() : '';
    if (!normalizedFolderPath || !normalizedCommitHash) {
      return {
        kind: 'missing',
      };
    }

    const dotGitPath = path.join(normalizedFolderPath, '.git');
    if (!existsSync(dotGitPath)) {
      return {
        kind: 'missing',
      };
    }

    try {
      const details = await loadCommitDetails(normalizedFolderPath, normalizedCommitHash);
      return {
        kind: 'ready',
        details,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        kind: 'error',
        errorMessage: message,
      };
    }
  }
}
