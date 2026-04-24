import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererAppServices } = require(path.join(rootDir, 'dist', 'renderer', 'app', 'services.js'));

const calls = [];
const services = createRendererAppServices({
  windowLike: {
    setTimeout(handler, timeout, ...arguments_) {
      calls.push(['setTimeout', timeout, ...arguments_]);
      if (typeof handler === 'function') {
        handler(...arguments_);
      }
      return 17;
    },
    clearTimeout(timeoutId) {
      calls.push(['clearTimeout', timeoutId]);
    },
    requestAnimationFrame(callback) {
      calls.push(['requestAnimationFrame']);
      callback(42);
      return 23;
    },
  },
  desktopPoc: { ping: async () => 'ok' },
  browserController: {
    openUrl() {},
    refreshNavigationState() {},
  },
  clipboard: { writeText: async () => {} },
  storage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  },
});

let timeoutValue = null;
const timeoutId = services.timers.setTimeout((value) => {
  timeoutValue = value;
}, 25, 'payload');
services.timers.clearTimeout(timeoutId);
let animationFrameValue = null;
const animationFrameId = services.timers.requestAnimationFrame((timestamp) => {
  animationFrameValue = timestamp;
});

assert.equal(timeoutId, 17);
assert.equal(animationFrameId, 23);
assert.equal(timeoutValue, 'payload');
assert.equal(animationFrameValue, 42);
assert.deepEqual(calls, [
  ['setTimeout', 25, 'payload'],
  ['clearTimeout', 17],
  ['requestAnimationFrame'],
]);

console.log('renderer-app-services-test: ok');
