import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleRendererForBrowser } from './lib/bundle-renderer.mjs';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const distDir = path.join(rootDir, 'dist');
const tscEntrypoint = path.join(rootDir, 'node_modules', 'typescript', 'lib', 'tsc.js');
const tscCommand = existsSync(tscEntrypoint) ? [process.execPath, [tscEntrypoint, '-p', path.join(rootDir, 'tsconfig.json')]] : ['tsc', ['-p', path.join(rootDir, 'tsconfig.json')]];

rmSync(distDir, { force: true, recursive: true });

execFileSync(tscCommand[0], tscCommand[1], {
  cwd: rootDir,
  stdio: 'inherit',
});

const injectedScriptOutputPath = path.join(distDir, 'browser', 'injected-script.js');
const debugCaptureOutputPath = path.join(distDir, 'browser', 'debug-capture-script.js');
const guestPreloadOutputPath = path.join(distDir, 'browser', 'guest-preload.js');
const injectedSource = readFileSync(injectedScriptOutputPath, 'utf8');
const debugCaptureSource = readFileSync(debugCaptureOutputPath, 'utf8');
const guestPreloadSource = readFileSync(guestPreloadOutputPath, 'utf8');

const injectedSourceLiteral = JSON.stringify(injectedSource);
const debugCaptureSourceLiteral = JSON.stringify(debugCaptureSource);
const injectedPlaceholder = 'return INJECTED_SOURCE_PLACEHOLDER;';
const debugCapturePlaceholder = 'return DEBUG_CAPTURE_SOURCE_PLACEHOLDER;';

if (!guestPreloadSource.includes(injectedPlaceholder)) {
  throw new Error('guest-preload.js does not contain the injected-source placeholder.');
}

if (!guestPreloadSource.includes(debugCapturePlaceholder)) {
  throw new Error('guest-preload.js does not contain the debug-capture-source placeholder.');
}

writeFileSync(
  guestPreloadOutputPath,
  guestPreloadSource
    .replace(injectedPlaceholder, () => `return ${injectedSourceLiteral};`)
    .replace(debugCapturePlaceholder, () => `return ${debugCaptureSourceLiteral};`),
  'utf8',
);

mkdirSync(path.join(distDir, 'renderer'), { recursive: true });
mkdirSync(path.join(distDir, 'renderer', 'vendor'), { recursive: true });
cpSync(path.join(rootDir, 'src', 'renderer', 'index.html'), path.join(distDir, 'renderer', 'index.html'));
mkdirSync(path.join(distDir, 'assets'), { recursive: true });
cpSync(path.join(rootDir, 'src', 'assets', 'drag-icon.png'), path.join(distDir, 'assets', 'drag-icon.png'));
cpSync(path.join(rootDir, 'src', 'renderer', 'styles.css'), path.join(distDir, 'renderer', 'styles.css'));
cpSync(path.join(rootDir, 'node_modules', 'xterm', 'lib', 'xterm.js'), path.join(distDir, 'renderer', 'vendor', 'xterm.js'));
cpSync(
  path.join(rootDir, 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js'),
  path.join(distDir, 'renderer', 'vendor', 'addon-fit.js'),
);
cpSync(path.join(rootDir, 'node_modules', 'xterm', 'css', 'xterm.css'), path.join(distDir, 'renderer', 'vendor', 'xterm.css'));
cpSync(
  path.join(rootDir, 'node_modules', 'markdown-it', 'dist', 'markdown-it.min.js'),
  path.join(distDir, 'renderer', 'vendor', 'markdown-it.min.js'),
);


bundleRendererForBrowser(distDir);
