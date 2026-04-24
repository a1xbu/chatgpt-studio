import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const require = createRequire(import.meta.url);

const { createRendererTreeMenuRuntime } = require(path.join(rootDir, 'dist', 'renderer', 'sidebar', 'tree-menu-runtime.js'));

let activeTreeMenu = null;
let activeTreeMenuCloseTimer = null;
let renderCount = 0;
let pendingTimer = null;
let clearedTimerId = null;

const runtime = createRendererTreeMenuRuntime({
  getContext: () => ({
    services: {
      timers: {
        setTimeout(callback, delayMs) {
          pendingTimer = { callback, delayMs };
          return 17;
        },
        clearTimeout(timerId) {
          clearedTimerId = timerId;
        },
      },
    },
    state: {
      treeMenu: {
        getActiveMenu: () => activeTreeMenu,
        setActiveMenu: (value) => {
          activeTreeMenu = value;
        },
        getCloseTimer: () => activeTreeMenuCloseTimer,
        setCloseTimer: (value) => {
          activeTreeMenuCloseTimer = value;
        },
      },
    },
    renderHooks: {
      render() {
        renderCount += 1;
      },
    },
  }),
  getTreeMenuKey: (state) => {
    if (!state) {
      return 'none';
    }
    return state.kind === 'project' ? `project:${state.projectId}` : `chat:${state.projectId}:${state.chatId}`;
  },
});

runtime.clearCloseTimer();
assert.equal(activeTreeMenuCloseTimer, null);
assert.equal(clearedTimerId, null);

activeTreeMenu = { kind: 'project', projectId: 'project-1' };
runtime.scheduleClose(25);
assert.equal(activeTreeMenuCloseTimer, 17);
assert.equal(pendingTimer?.delayMs, 25);

runtime.clearCloseTimer();
assert.equal(clearedTimerId, 17);
assert.equal(activeTreeMenuCloseTimer, null);

activeTreeMenu = { kind: 'chat', projectId: 'project-1', chatId: 'chat-1' };
runtime.scheduleClose();
assert.equal(activeTreeMenuCloseTimer, 17);
pendingTimer.callback();
assert.equal(activeTreeMenu, null);
assert.equal(activeTreeMenuCloseTimer, null);
assert.equal(renderCount, 1);

activeTreeMenu = { kind: 'project', projectId: 'project-2' };
runtime.close(false);
assert.equal(activeTreeMenu, null);
assert.equal(renderCount, 1);

console.log('renderer-tree-menu-runtime-test: ok');
