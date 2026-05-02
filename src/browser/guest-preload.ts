import { ipcRenderer, webFrame } from 'electron';

const PAGE_CONTEXT_MESSAGE_SOURCE = 'chatgpt-desktop-poc:page-context';
const PAGE_DEBUG_MESSAGE_SOURCE = 'chatgpt-desktop-poc:debug';
const PAGE_HISTORY_MESSAGE_SOURCE = 'chatgpt-desktop-poc:conversation-history';
const PAGE_APP_REQUEST_MESSAGE_SOURCE = 'chatgpt-desktop-poc:app-request';
const PAGE_APP_RESPONSE_MESSAGE_SOURCE = 'chatgpt-desktop-poc:app-response';
const PAGE_APP_COMMAND_MESSAGE_SOURCE = 'chatgpt-desktop-poc:app-command';
const PAGE_FILE_STATUS_MESSAGE_SOURCE = 'chatgpt-desktop-poc:file-status';
const PAGE_DEBUG_CAPTURE_MESSAGE_SOURCE = 'chatgpt-desktop-poc:debug-capture';
const INJECTED_SOURCE_PLACEHOLDER = '__CHATGPT_DESKTOP_POC_INJECTED_SOURCE__';
const DEBUG_CAPTURE_SOURCE_PLACEHOLDER = '__CHATGPT_DESKTOP_POC_DEBUG_CAPTURE_SOURCE__';

let installStarted = false;

function postDebug(level: 'info' | 'warn' | 'error', message: string, details: string | null = null): void {
  ipcRenderer.send('chatgpt-page:debug', {
    level,
    message,
    details,
    source: 'guest-preload',
    timestamp: new Date().toISOString(),
  });
}

function isSupportedHost(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname === 'chatgpt.com' ||
    hostname.endsWith('.chatgpt.com') ||
    hostname === 'chat.openai.com' ||
    hostname.endsWith('.chat.openai.com')
  );
}

function getInjectedSource(): string {
  return INJECTED_SOURCE_PLACEHOLDER;
}

function getDebugCaptureSource(): string {
  return DEBUG_CAPTURE_SOURCE_PLACEHOLDER;
}

async function isDebugCaptureEnabled(): Promise<boolean> {
  try {
    return Boolean(await ipcRenderer.invoke('chatcap-debug:enabled'));
  } catch {
    return false;
  }
}

async function installInjectedScript(): Promise<void> {
  if (installStarted) {
    return;
  }

  installStarted = true;

  if (!isSupportedHost()) {
    postDebug('warn', `Guest preload skipped unsupported host "${window.location.hostname}".`);
    return;
  }

  if (!getInjectedSource() || getInjectedSource() === INJECTED_SOURCE_PLACEHOLDER) {
    postDebug('error', 'Injected script source is empty. Build output is incomplete.');
    return;
  }

  try {
    await webFrame.executeJavaScript(getInjectedSource(), true);
    postDebug('info', 'Injected script executed through webFrame.executeJavaScript().');
  } catch (error) {
    const details = error instanceof Error ? error.stack ?? error.message : String(error);
    postDebug('error', 'Failed to execute injected script through webFrame.executeJavaScript().', details);
  }

  const debugEnabled = await isDebugCaptureEnabled();
  if (!debugEnabled) {
    return;
  }

  const debugSource = getDebugCaptureSource();
  if (!debugSource || debugSource === DEBUG_CAPTURE_SOURCE_PLACEHOLDER) {
    postDebug('warn', 'Debug capture requested but the script source was not bundled.');
    return;
  }

  try {
    await webFrame.executeJavaScript(debugSource, true);
    postDebug('info', 'Debug capture script executed (--debug mode).');
  } catch (error) {
    const details = error instanceof Error ? error.stack ?? error.message : String(error);
    postDebug('error', 'Failed to execute debug capture script.', details);
  }
}

async function handlePageAppRequest(data: { requestId?: unknown; action?: unknown; payload?: unknown }): Promise<void> {
  const requestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
  const action = typeof data.action === 'string' ? data.action.trim() : '';
  if (!requestId || !action) {
    return;
  }

  try {
    let payload: unknown;
    if (action === 'register-sandbox-file') {
      payload = await ipcRenderer.invoke('chatgpt-file:register', data.payload);
    } else if (action === 'register-sandbox-files') {
      payload = await ipcRenderer.invoke('chatgpt-file:register-many', data.payload);
    } else if (action === 'save-downloaded-file') {
      payload = await ipcRenderer.invoke('chatgpt-file:save', data.payload);
    } else {
      throw new Error(`Unknown page bridge action: ${action}`);
    }

    window.postMessage(
      {
        source: PAGE_APP_RESPONSE_MESSAGE_SOURCE,
        payload: {
          requestId,
          ok: true,
          payload,
        },
      },
      '*',
    );
  } catch (error) {
    window.postMessage(
      {
        source: PAGE_APP_RESPONSE_MESSAGE_SOURCE,
        payload: {
          requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
      },
      '*',
    );
  }
}

process.once('loaded', () => {
  void installInjectedScript();
});

void installInjectedScript();

ipcRenderer.on('chatgpt-file:command', (_event, payload) => {
  window.postMessage(
    {
      source: PAGE_APP_COMMAND_MESSAGE_SOURCE,
      payload,
    },
    '*',
  );
});

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || typeof event.data !== 'object') {
    return;
  }

  const candidate = event.data as { payload?: unknown; source?: unknown; requestId?: unknown; action?: unknown };
  if (candidate.source === PAGE_CONTEXT_MESSAGE_SOURCE) {
    ipcRenderer.send('chatgpt-page:context', candidate.payload);
    return;
  }

  if (candidate.source === PAGE_HISTORY_MESSAGE_SOURCE) {
    ipcRenderer.send('chatgpt-page:conversation-history', candidate.payload);
    return;
  }

  if (candidate.source === PAGE_APP_REQUEST_MESSAGE_SOURCE) {
    void handlePageAppRequest(candidate);
    return;
  }

  if (candidate.source === PAGE_FILE_STATUS_MESSAGE_SOURCE) {
    ipcRenderer.sendToHost('chatgpt-file:status', candidate.payload);
    return;
  }

  if (candidate.source === PAGE_DEBUG_MESSAGE_SOURCE) {
    ipcRenderer.send('chatgpt-page:debug', candidate.payload);
    return;
  }

  if (candidate.source === PAGE_DEBUG_CAPTURE_MESSAGE_SOURCE) {
    ipcRenderer.send('chatcap-debug:dump', candidate.payload);
  }
});
