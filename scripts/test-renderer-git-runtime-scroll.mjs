import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { renderGitPanel } = require(path.join(rootDir, 'dist', 'renderer', 'git', 'runtime.js'));

class FakeScrollElement {
  constructor(role, scrollTop = 0) {
    this.role = role;
    this.scrollTop = scrollTop;
  }
}

class FakeGitViewElement {
  constructor(scrollTops = {}) {
    this._scrolls = new Map([
      ['branches', new FakeScrollElement('branches', scrollTops.branches ?? 0)],
      ['commits', new FakeScrollElement('commits', scrollTops.commits ?? 0)],
      ['files', new FakeScrollElement('files', scrollTops.files ?? 0)],
    ]);
    this._innerHTML = '';
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this._scrolls = new Map([
      ['branches', new FakeScrollElement('branches', 0)],
      ['commits', new FakeScrollElement('commits', 0)],
      ['files', new FakeScrollElement('files', 0)],
    ]);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  querySelector(selector) {
    const match = selector.match(/\[data-git-scroll="([^"]+)"\]/);
    if (!match) {
      return null;
    }
    return this._scrolls.get(match[1]) ?? null;
  }
}

globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 1;
};

const gitViewElement = new FakeGitViewElement({
  branches: 14,
  commits: 181,
  files: 33,
});

const overview = {
  repoRootPath: '/repo',
  currentBranch: {
    name: 'main',
    isCurrent: true,
    upstream: null,
    aheadBy: 0,
    behindBy: 0,
    shortHash: 'a1',
    commitHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  selectedRefName: 'main',
  statusSummary: {
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicted: 0,
  },
  branches: [
    {
      name: 'main',
      isCurrent: true,
      upstream: null,
      aheadBy: 0,
      behindBy: 0,
      shortHash: 'a1',
      commitHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  ],
  commits: [
    {
      hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shortHash: 'a1',
      authorName: 'OpenAI',
      authoredAt: '2026-04-22T15:31:00.000Z',
      subject: 'commit',
      refs: ['HEAD -> main'],
      parentHashes: [],
    },
  ],
};

renderGitPanel({
  currentState: {
    projects: [
      {
        projectId: 'project-1',
        projectName: 'Repo',
        folderPath: '/repo',
      },
    ],
    activeProjectId: 'project-1',
  },
  state: {
    activeBottomTabId: 'git',
    gitPanelProjectId: 'project-1',
    gitPanelSelectedRefName: 'main',
    gitPanelOverview: overview,
    gitPanelLoadError: null,
    gitPanelLoadingRequest: 1,
    gitPanelIsLoading: false,
    selectedGitBranchName: 'main',
    selectedGitCommitHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    gitCommitDetails: {
      commitHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      files: [{ path: 'src/index.ts', status: 'M', oldPath: null }],
    },
    gitCommitDetailsError: null,
    gitCommitDetailsIsLoading: false,
    gitCommitDetailsLoadingRequest: 1,
  },
  gitViewElement,
  escapeHtml: (value) => String(value ?? ''),
  formatTimestamp: (value) => String(value ?? ''),
  renderGitFileTreeNodes: () => '<div>tree</div>',
  renderRefreshIcon: () => '<svg></svg>',
  getActiveSidebarProject: (state) => state.projects.find((project) => project.projectId === state.activeProjectId) ?? null,
});

assert.equal(gitViewElement.querySelector('[data-git-scroll="branches"]').scrollTop, 14);
assert.equal(gitViewElement.querySelector('[data-git-scroll="commits"]').scrollTop, 181);
assert.equal(gitViewElement.querySelector('[data-git-scroll="files"]').scrollTop, 33);
