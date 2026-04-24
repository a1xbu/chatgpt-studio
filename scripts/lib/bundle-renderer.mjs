import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function collectJavaScriptModules(directoryPath, rootPath, output = new Map()) {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptModules(fullPath, rootPath, output);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    const relativePath = `./${path.relative(rootPath, fullPath).replace(/\\/g, '/')}`;
    output.set(relativePath, readFileSync(fullPath, 'utf8'));
  }

  return output;
}

function resolveModuleId(parentId, specifier) {
  if (!specifier.startsWith('.')) {
    return specifier;
  }

  const parentDirectory = path.posix.dirname(parentId);
  let resolved = path.posix.normalize(path.posix.join(parentDirectory, specifier));
  if (!resolved.endsWith('.js')) {
    resolved += '.js';
  }
  if (!resolved.startsWith('.')) {
    resolved = `./${resolved}`;
  }
  return resolved;
}

function buildRuntimeResolveModuleIdSource() {
  return `function resolveModuleId(parentId, specifier) {
  if (!specifier.startsWith('.')) {
    return specifier;
  }

  const baseSegments = parentId.split('/');
  baseSegments.pop();
  const specifierSegments = specifier.split('/');
  const outputSegments = [];

  for (const segment of [...baseSegments, ...specifierSegments]) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (outputSegments.length > 0) {
        outputSegments.pop();
      }
      continue;
    }
    outputSegments.push(segment);
  }

  let resolved = outputSegments.join('/');
  if (!resolved.endsWith('.js')) {
    resolved += '.js';
  }
  if (!resolved.startsWith('.')) {
    resolved = './' + resolved;
  }
  return resolved;
}`;
}

function buildBrowserBundle(entryId, modules) {
  const moduleEntries = [...modules.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([moduleId, source]) => `${JSON.stringify(moduleId)}: function(module, exports, require) {\n${source}\n}`)
    .join(',\n');

  const runtimeResolveModuleIdSource = buildRuntimeResolveModuleIdSource();

  return `(() => {\n'use strict';\nconst __modules = {\n${moduleEntries}\n};\n${runtimeResolveModuleIdSource}\nconst __cache = Object.create(null);\nfunction __load(moduleId) {\n  if (Object.prototype.hasOwnProperty.call(__cache, moduleId)) {\n    return __cache[moduleId].exports;\n  }\n  const factory = __modules[moduleId];\n  if (!factory) {\n    throw new Error(\`Renderer bundle is missing module: \${moduleId}\`);\n  }\n  const module = { exports: {} };\n  __cache[moduleId] = module;\n  const localRequire = (specifier) => {\n    const resolvedId = resolveModuleId(moduleId, specifier);\n    if (!Object.prototype.hasOwnProperty.call(__modules, resolvedId)) {\n      throw new Error(\`Cannot resolve renderer module "\${specifier}" from "\${moduleId}" (resolved as "\${resolvedId}")\`);\n    }\n    return __load(resolvedId);\n  };\n  factory(module, module.exports, localRequire);\n  return module.exports;\n}\n__load(${JSON.stringify(entryId)});\n})();\n`;
}

export function bundleRendererForBrowser(distDir) {
  const rendererDir = path.join(distDir, 'renderer');
  const modules = collectJavaScriptModules(rendererDir, rendererDir);
  const sharedDir = path.join(distDir, 'shared');
  try {
    collectJavaScriptModules(sharedDir, distDir, modules);
  } catch {
    // shared modules are optional for the browser bundle
  }

  const entryId = './renderer.js';
  if (!modules.has(entryId)) {
    throw new Error(`Renderer bundle entry not found: ${entryId}`);
  }

  const entrySource = modules.get(entryId) ?? '';
  if (entrySource.includes('const __modules = {') && entrySource.includes('__load("./renderer.js")')) {
    throw new Error('Renderer entry appears to be bundled already. Re-run TypeScript compilation before bundling.');
  }

  const bundleSource = buildBrowserBundle(entryId, modules);
  writeFileSync(path.join(rendererDir, 'renderer.js'), bundleSource, 'utf8');
}
