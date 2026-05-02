import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.CHATCAP_PORT ?? 4781);
const HOST = process.env.CHATCAP_HOST ?? '127.0.0.1';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const outDir = path.resolve(repoRoot, '.chatgpt-capture');
mkdirSync(outDir, { recursive: true });

const snippetPath = path.join(here, 'debug-capture-snippet.js');

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Capture-Tag');
  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
}

function sanitizeTag(value) {
  const raw = String(value ?? 'snapshot').trim();
  const cleaned = raw.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'snapshot';
}

function buildFileName(tag) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${ts}__${sanitizeTag(tag)}.json`;
}

const server = createServer(async (request, response) => {
  setCors(response);

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method === 'GET' && (request.url === '/install.js' || request.url?.startsWith('/install.js'))) {
    try {
      const { readFile } = await import('node:fs/promises');
      const snippet = await readFile(snippetPath, 'utf8');
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      response.end(snippet);
    } catch (error) {
      response.statusCode = 500;
      response.end(`Failed to read snippet: ${String(error)}`);
    }
    return;
  }

  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.end('POST only (or GET /install.js).');
    return;
  }

  const chunks = [];
  let totalLength = 0;
  request.on('data', (chunk) => {
    chunks.push(chunk);
    totalLength += chunk.length;
  });
  request.on('end', () => {
    const tag = request.headers['x-capture-tag'] ?? 'snapshot';
    const fileName = buildFileName(tag);
    const filePath = path.join(outDir, fileName);
    const body = Buffer.concat(chunks, totalLength);

    try {
      writeFileSync(filePath, body);
      const sizeMb = (body.length / (1024 * 1024)).toFixed(2);
      console.log(`[capture] ${fileName} (${sizeMb} MB)`);
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ saved: true, fileName, path: filePath, bytes: body.length }));
    } catch (error) {
      console.error('[capture] write failed:', error);
      response.statusCode = 500;
      response.end(JSON.stringify({ saved: false, error: String(error) }));
    }
  });
  request.on('error', (error) => {
    console.error('[capture] request error:', error);
    response.statusCode = 400;
    response.end(JSON.stringify({ saved: false, error: String(error) }));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[capture] listening on http://${HOST}:${PORT}`);
  console.log(`[capture] writing dumps to ${outDir}`);
  console.log(`[capture] paste contents of ${snippetPath} into the ChatGPT tab DevTools console`);
});
