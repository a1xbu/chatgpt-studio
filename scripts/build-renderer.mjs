import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleRendererForBrowser } from './lib/bundle-renderer.mjs';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const distDir = path.join(rootDir, 'dist');
const distRendererDir = path.join(distDir, 'renderer');
const distSharedDir = path.join(distDir, 'shared');
const tscEntrypoint = path.join(rootDir, 'node_modules', 'typescript', 'lib', 'tsc.js');
const tscCommand = existsSync(tscEntrypoint)
  ? [process.execPath, [tscEntrypoint, '-p', path.join(rootDir, 'tsconfig.renderer.json')]]
  : ['tsc', ['-p', path.join(rootDir, 'tsconfig.renderer.json')]];

rmSync(distRendererDir, { force: true, recursive: true });
rmSync(distSharedDir, { force: true, recursive: true });

execFileSync(tscCommand[0], tscCommand[1], {
  cwd: rootDir,
  stdio: 'inherit',
});

mkdirSync(distRendererDir, { recursive: true });
cpSync(path.join(rootDir, 'src', 'renderer', 'index.html'), path.join(distRendererDir, 'index.html'));
cpSync(path.join(rootDir, 'src', 'renderer', 'styles.css'), path.join(distRendererDir, 'styles.css'));

bundleRendererForBrowser(distDir);
