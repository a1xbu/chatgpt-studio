import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { GitService } = require(path.join(rootDir, 'dist-main-test', 'main', 'git-service.js'));

function git(repoPath, ...args) {
  return execFileSync('git', ['-C', repoPath, ...args], { encoding: 'utf8' }).trim();
}

function gitWithDates(repoPath, authoredAt, ...args) {
  return execFileSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: authoredAt,
      GIT_COMMITTER_DATE: authoredAt,
    },
  }).trim();
}

const repoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'git-service-test-'));
try {
  git(repoPath, 'init', '-b', 'main');
  git(repoPath, 'config', 'user.name', 'OpenAI');
  git(repoPath, 'config', 'user.email', 'openai@example.com');

  await fs.writeFile(path.join(repoPath, 'README.md'), 'root\n');
  git(repoPath, 'add', 'README.md');
  gitWithDates(repoPath, '2026-04-22T15:00:00Z', 'commit', '-m', 'root');

  git(repoPath, 'checkout', '-b', 'feature/multi-branch');
  await fs.writeFile(path.join(repoPath, 'feature.txt'), 'feature\n');
  git(repoPath, 'add', 'feature.txt');
  gitWithDates(repoPath, '2026-04-22T15:20:00Z', 'commit', '-m', 'feature commit');
  const featureHead = git(repoPath, 'rev-parse', 'HEAD');

  git(repoPath, 'checkout', 'main');
  await fs.writeFile(path.join(repoPath, 'main.txt'), 'main\n');
  git(repoPath, 'add', 'main.txt');
  gitWithDates(repoPath, '2026-04-22T15:10:00Z', 'commit', '-m', 'main commit');
  const mainHead = git(repoPath, 'rev-parse', 'HEAD');

  const service = new GitService();
  const result = await service.getOverview(repoPath, 'main');
  assert.equal(result.kind, 'ready');
  if (result.kind !== 'ready') {
    throw new Error('Expected git overview');
  }

  assert.equal(result.overview.selectedRefName, 'main');
  assert.equal(result.overview.currentBranch?.name, 'main');
  assert.equal(result.overview.branches.find((branch) => branch.name === 'main')?.commitHash, mainHead);
  assert.equal(result.overview.branches.find((branch) => branch.name === 'feature/multi-branch')?.commitHash, featureHead);
  assert.ok(result.overview.commits.some((commit) => commit.subject === 'main commit'));
  assert.ok(result.overview.commits.some((commit) => commit.subject === 'feature commit'));
  assert.deepEqual(
    result.overview.commits.slice(0, 3).map((commit) => commit.subject),
    ['feature commit', 'main commit', 'root'],
  );

  console.log('main-git-service-test: ok');
} finally {
  await fs.rm(repoPath, { recursive: true, force: true });
}
