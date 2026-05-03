import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { renderGitPanelMarkup } = require(path.join(rootDir, 'dist', 'renderer', 'git', 'panel.js'));

function getCommitRowMarkup(fullMarkup, commitHash) {
  const marker = `data-commit-hash="${commitHash}"`;
  const markerIndex = fullMarkup.indexOf(marker);
  assert.notEqual(markerIndex, -1, `expected commit row for ${commitHash}`);
  const startIndex = fullMarkup.lastIndexOf('<button', markerIndex);
  const endIndex = fullMarkup.indexOf('</button>', markerIndex);
  assert.notEqual(startIndex, -1, `expected button start for ${commitHash}`);
  assert.notEqual(endIndex, -1, `expected button end for ${commitHash}`);
  return fullMarkup.slice(startIndex, endIndex + '</button>'.length);
}

const sharedHelpers = {
  escapeHtml: (value) => String(value ?? ''),
  formatTimestamp: (value) => value ?? '',
  renderGitFileTreeNodes: () => '<div>file tree</div>',
  renderRefreshIcon: () => '<svg></svg>',
};

const overview = {
  repoRootPath: '/repo',
  currentBranch: {
    name: 'test',
    isCurrent: true,
    upstream: null,
    aheadBy: 0,
    behindBy: 0,
    shortHash: 't1',
    commitHash: 'tttttttttttttttttttttttttttttttttttttttt',
  },
  selectedRefName: 'test',
  statusSummary: {
    staged: 1,
    unstaged: 0,
    untracked: 2,
    conflicted: 0,
  },
  branches: [
    {
      name: 'test',
      isCurrent: true,
      upstream: null,
      aheadBy: 0,
      behindBy: 0,
      shortHash: 't1',
      commitHash: 'tttttttttttttttttttttttttttttttttttttttt',
    },
    {
      name: 'main',
      isCurrent: false,
      upstream: 'origin/main',
      aheadBy: 0,
      behindBy: 0,
      shortHash: 'm2',
      commitHash: 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    },
  ],
  commits: [
    {
      hash: 'tttttttttttttttttttttttttttttttttttttttt',
      shortHash: 't1',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:31:00.000Z',
      subject: 'test',
      refs: ['HEAD -> test'],
      parentHashes: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    },
    {
      hash: 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
      shortHash: 'm2',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:25:00.000Z',
      subject: 'Fix file tree coloring regressions',
      refs: ['main'],
      parentHashes: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    },
    {
      hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shortHash: 'a1',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:08:00.000Z',
      subject: 'Fix renderer startup bundle and extract browser controller',
      refs: [],
      parentHashes: ['pppppppppppppppppppppppppppppppppppppppp'],
    },
    {
      hash: 'pppppppppppppppppppppppppppppppppppppppp',
      shortHash: 'p0',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:07:00.000Z',
      subject: 'Fix renderer startup and extract browser wiring',
      refs: [],
      parentHashes: [],
    },
  ],
};

const markup = renderGitPanelMarkup(
  {
    activeProjectName: 'Repo',
    hasProject: true,
    isLoading: false,
    loadError: null,
    overview,
    selectedBranchName: 'test',
    selectedCommitHash: overview.commits[1].hash,
    commitDetails: {
      commitHash: overview.commits[1].hash,
      files: [{ path: 'src/index.ts', status: 'M', oldPath: null }],
    },
    commitDetailsIsLoading: false,
    commitDetailsError: null,
  },
  sharedHelpers,
);

const mainCommitRow = getCommitRowMarkup(markup, 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm');
const branchBaseRow = getCommitRowMarkup(markup, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
const olderBaseRow = getCommitRowMarkup(markup, 'pppppppppppppppppppppppppppppppppppppppp');

assert.match(markup, /All local branches · focus test/);
assert.match(markup, /git-branch-row--active/);
assert.match(markup, /git-branch-row--selected/);
assert.match(markup, /--git-branch-color:#57d38c/);
assert.match(markup, /--git-branch-color:#f2c94c/);
assert.match(markup, /git-commit-row__graph-node--terminal/);
assert.match(markup, /Fix file tree coloring regressions/);
assert.match(markup, /origin\/main/);
assert.match(mainCommitRow, /git-commit-row__graph-node--terminal/);
assert.match(mainCommitRow, /<circle[^>]*r="5"/);
assert.match(mainCommitRow, /<circle[^>]*cx="18"[^>]*fill="#57d38c"/);
assert.doesNotMatch(mainCommitRow, /x1="18" y1="0" x2="18" y2="12"[^>]*stroke="#57d38c"/);
assert.match(mainCommitRow, /x1="18" y1="12" x2="18" y2="24"[^>]*stroke="#57d38c"/);
assert.match(branchBaseRow, /<circle[^>]*fill="#57d38c"/);
assert.match(branchBaseRow, /x1="18" y1="12" x2="8" y2="0"[^>]*stroke="#f2c94c"/);
assert.match(branchBaseRow, /x1="8" y1="12" x2="8" y2="24"[^>]*stroke="#57d38c"/);
assert.match(olderBaseRow, /<circle[^>]*fill="#57d38c"/);
assert.match(olderBaseRow, /x1="8" y1="0" x2="8" y2="12"[^>]*stroke="#57d38c"/);
assert.doesNotMatch(olderBaseRow, /stroke="#f2c94c"/);

const multiBranchOverview = {
  repoRootPath: '/repo',
  currentBranch: {
    name: 'test',
    isCurrent: true,
    upstream: null,
    aheadBy: 0,
    behindBy: 0,
    shortHash: 't2',
    commitHash: 'T2',
  },
  selectedRefName: 'test',
  statusSummary: {
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicted: 0,
  },
  branches: [
    {
      name: 'test',
      isCurrent: true,
      upstream: null,
      aheadBy: 0,
      behindBy: 0,
      shortHash: 't2',
      commitHash: 'T2',
    },
    {
      name: 'main',
      isCurrent: false,
      upstream: null,
      aheadBy: 0,
      behindBy: 0,
      shortHash: 'm3',
      commitHash: 'M3',
    },
    {
      name: 'feat3',
      isCurrent: false,
      upstream: null,
      aheadBy: 0,
      behindBy: 0,
      shortHash: 'f1',
      commitHash: 'F1',
    },
  ],
  commits: [
    {
      hash: 'T2',
      shortHash: 't2',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:31:00.000Z',
      subject: 'test2',
      refs: ['HEAD -> test'],
      parentHashes: ['T1'],
    },
    {
      hash: 'M3',
      shortHash: 'm3',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:30:00.000Z',
      subject: 'main3',
      refs: ['main'],
      parentHashes: ['M2'],
    },
    {
      hash: 'T1',
      shortHash: 't1',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:29:00.000Z',
      subject: 'test1',
      refs: [],
      parentHashes: ['A1'],
    },
    {
      hash: 'F1',
      shortHash: 'f1',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:28:00.000Z',
      subject: 'feat3',
      refs: ['feat3'],
      parentHashes: ['A1'],
    },
    {
      hash: 'M2',
      shortHash: 'm2',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:27:00.000Z',
      subject: 'main2',
      refs: [],
      parentHashes: ['A1'],
    },
    {
      hash: 'A1',
      shortHash: 'a1',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:26:00.000Z',
      subject: 'base',
      refs: [],
      parentHashes: ['P0'],
    },
    {
      hash: 'P0',
      shortHash: 'p0',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:25:00.000Z',
      subject: 'older',
      refs: [],
      parentHashes: [],
    },
  ],
};

const multiBranchMarkup = renderGitPanelMarkup(
  {
    activeProjectName: 'Repo',
    hasProject: true,
    isLoading: false,
    loadError: null,
    overview: multiBranchOverview,
    selectedBranchName: 'test',
    selectedCommitHash: null,
    commitDetails: null,
    commitDetailsIsLoading: false,
    commitDetailsError: null,
  },
  sharedHelpers,
);

const multiBranchFeatureRow = getCommitRowMarkup(multiBranchMarkup, 'M2');
const multiBranchSideHeadRow = getCommitRowMarkup(multiBranchMarkup, 'F1');
const multiBranchBaseRow = getCommitRowMarkup(multiBranchMarkup, 'A1');
const multiBranchOlderRow = getCommitRowMarkup(multiBranchMarkup, 'P0');
assert.match(multiBranchFeatureRow, /x1="28" y1="0" x2="28" y2="12"[^>]*stroke="#ff7a59"/);
assert.doesNotMatch(multiBranchFeatureRow, /x1="18" y1="0" x2="28" y2="12"[^>]*stroke="#ff7a59"/);
assert.match(multiBranchSideHeadRow, /git-commit-row__graph-node--terminal/);
assert.match(multiBranchSideHeadRow, /<circle[^>]*r="5"/);
assert.match(multiBranchBaseRow, /<circle[^>]*fill="#57d38c"/);
assert.match(multiBranchBaseRow, /x1="8" y1="12" x2="18" y2="0"[^>]*stroke="#f2c94c"/);
assert.match(multiBranchBaseRow, /x1="8" y1="12" x2="28" y2="0"[^>]*stroke="#ff7a59"/);
assert.match(multiBranchBaseRow, /x1="8" y1="12" x2="8" y2="24"[^>]*stroke="#57d38c"/);
assert.match(multiBranchOlderRow, /<circle[^>]*fill="#57d38c"/);
assert.doesNotMatch(multiBranchOlderRow, /stroke="#f2c94c"/);
assert.doesNotMatch(multiBranchOlderRow, /stroke="#ff7a59"/);

console.log('renderer-git-panel-test: ok');
