// Debug capture probe — injected only when the app is started with --debug.
// Patches every transport that ChatGPT might use (fetch, XHR, WebSocket, EventSource,
// Workers, ServiceWorker, BroadcastChannel) and ships dumps back to main process via
// window.postMessage on the chatgpt-desktop-poc:debug-capture channel.

(function bootstrapDebugCapture() {
  type DebugTrafficEntry = {
    id: number;
    kind: 'fetch' | 'xhr' | 'websocket' | 'eventsource' | 'worker' | 'shared-worker' | 'service-worker' | 'broadcast-channel';
    method?: string | null;
    url: string;
    startedAt: string;
    finishedAt: string | null;
    status?: number | null;
    statusText?: string | null;
    contentType?: string | null;
    reqHeaders?: Record<string, unknown> | null;
    reqBody?: string | null;
    body?: string | null;
    bodyTruncated?: boolean;
    respHeaders?: Record<string, unknown> | null;
    error?: string | null;
    stream?: boolean;
    messages?: Array<Record<string, unknown>>;
  };

  type DumpOptions = {
    includeDom?: boolean;
    includeResourceTimings?: boolean;
    includeServiceWorkers?: boolean;
  };

  const injectedWindow = window as Window & { __chatcapInstalled?: boolean };
  if (injectedWindow.__chatcapInstalled) {
    return;
  }
  injectedWindow.__chatcapInstalled = true;

  const SOURCE = 'chatgpt-desktop-poc:debug-capture';
  const DEBUG_SOURCE = 'chatgpt-desktop-poc:debug';
  const MAX_BODY_BYTES = 6 * 1024 * 1024;
  const MAX_TRAFFIC_ENTRIES = 1200;
  const MAX_NAV_ENTRIES = 200;
  const MAX_DOM_BYTES = 4 * 1024 * 1024;

  const traffic: DebugTrafficEntry[] = [];
  const navigation: Array<Record<string, unknown>> = [];
  const consoleEvents: Array<Record<string, unknown>> = [];
  let counter = 0;
  let currentChatId: string | null = detectChatId();
  let autoDumpOnChatChange = true;

  function nextId(): number {
    counter += 1;
    return counter;
  }

  function nowIso(): string {
    return new Date().toISOString();
  }

  function detectChatId(): string | null {
    const match = window.location.pathname.match(/\/c\/([0-9a-f-]{8,})/i);
    return match ? match[1] : null;
  }

  function pushBounded<T>(bucket: T[], entry: T, limit: number): void {
    bucket.push(entry);
    if (bucket.length > limit) {
      bucket.splice(0, bucket.length - limit);
    }
  }

  function summarize(value: unknown): string | null {
    if (value == null) {
      return null;
    }
    let text: string;
    try {
      if (typeof value === 'string') {
        text = value;
      } else if (value instanceof ArrayBuffer) {
        text = `(ArrayBuffer ${String(value.byteLength)} bytes)`;
      } else if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView;
        text = `(${view.constructor.name} ${String(view.byteLength)} bytes)`;
      } else if (value instanceof Blob) {
        text = `(Blob ${String(value.size)} bytes type=${value.type || 'unknown'})`;
      } else if (typeof FormData !== 'undefined' && value instanceof FormData) {
        const parts: string[] = [];
        value.forEach((entryValue, key) => {
          parts.push(`${key}=${typeof entryValue === 'string' ? entryValue : `(File ${String((entryValue as File).name ?? '')} ${String((entryValue as File).size ?? 0)} bytes)`}`);
        });
        text = `(FormData ${parts.join('&')})`;
      } else if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
        text = value.toString();
      } else {
        text = String(value);
      }
    } catch (error) {
      text = `(summarize-error: ${String(error)})`;
    }
    if (text.length > MAX_BODY_BYTES) {
      return text.slice(0, MAX_BODY_BYTES) + `\n…[truncated ${String(text.length - MAX_BODY_BYTES)} bytes]`;
    }
    return text;
  }

  function postChannel(channel: string, payload: unknown): void {
    try {
      window.postMessage({ source: channel, payload }, '*');
    } catch (error) {
      // Intentionally swallow — debugger should never crash the page.
      void error;
    }
  }

  function logDebug(level: 'info' | 'warn' | 'error', message: string, details: string | null = null): void {
    postChannel(DEBUG_SOURCE, {
      level,
      message: `[chatcap-debug] ${message}`,
      details,
      source: 'injected-script',
      timestamp: nowIso(),
    });
  }

  // ---- fetch hook -----------------------------------------------------------
  const origFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const id = nextId();
    let url: string;
    let method: string;
    if (typeof input === 'string') {
      url = input;
      method = (init && init.method) || 'GET';
    } else if (input instanceof Request) {
      url = input.url;
      method = (init && init.method) || input.method || 'GET';
    } else {
      url = String(input);
      method = (init && init.method) || 'GET';
    }
    const reqHeaders = serializeRequestHeaders(init, input);
    const reqBody = await readRequestBody(input, init);
    const entry: DebugTrafficEntry = {
      id,
      kind: 'fetch',
      method: method.toUpperCase(),
      url,
      startedAt: nowIso(),
      finishedAt: null,
      reqHeaders,
      reqBody,
      status: null,
      statusText: null,
      contentType: null,
      respHeaders: null,
      body: '',
      bodyTruncated: false,
      stream: false,
      error: null,
    };
    pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);

    try {
      const response = await origFetch(input as RequestInfo, init);
      entry.status = response.status;
      entry.statusText = response.statusText;
      entry.contentType = response.headers.get('content-type');
      entry.respHeaders = headersToObject(response.headers);
      const cloned = response.clone();
      const contentType = entry.contentType ?? '';
      const isStream = contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson');
      if (isStream) {
        entry.stream = true;
        void readStreamingResponse(cloned, entry);
      } else {
        cloned
          .text()
          .then((text) => {
            if (text.length > MAX_BODY_BYTES) {
              entry.bodyTruncated = true;
            }
            entry.body = summarize(text);
            entry.finishedAt = nowIso();
          })
          .catch((readError: unknown) => {
            entry.error = String(readError);
            entry.finishedAt = nowIso();
          });
      }
      return response;
    } catch (error) {
      entry.error = String(error);
      entry.finishedAt = nowIso();
      throw error;
    }
  };

  function serializeRequestHeaders(init: RequestInit | undefined, input: RequestInfo | URL): Record<string, unknown> | null {
    try {
      if (init && init.headers) {
        if (init.headers instanceof Headers) {
          return headersToObject(init.headers);
        }
        if (Array.isArray(init.headers)) {
          return Object.fromEntries(init.headers);
        }
        return { ...(init.headers as Record<string, string>) };
      }
      if (input instanceof Request) {
        return headersToObject(input.headers);
      }
    } catch (error) {
      return { _error: String(error) };
    }
    return null;
  }

  function headersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    try {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } catch (error) {
      result._error = String(error);
    }
    return result;
  }

  async function readRequestBody(input: RequestInfo | URL, init: RequestInit | undefined): Promise<string | null> {
    try {
      if (init && init.body !== undefined) {
        return summarize(init.body);
      }
      if (input instanceof Request) {
        const cloned = input.clone();
        const text = await cloned.text();
        return summarize(text);
      }
    } catch (error) {
      return `(req-body-error: ${String(error)})`;
    }
    return null;
  }

  async function readStreamingResponse(response: Response, entry: DebugTrafficEntry): Promise<void> {
    try {
      if (!response.body) {
        entry.body = '(no-readable-body)';
        entry.finishedAt = nowIso();
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        acc += decoder.decode(value, { stream: true });
        if (acc.length > MAX_BODY_BYTES) {
          entry.bodyTruncated = true;
          acc = acc.slice(0, MAX_BODY_BYTES);
          break;
        }
      }
      entry.body = summarize(acc);
      entry.finishedAt = nowIso();
    } catch (error) {
      entry.error = String(error);
      entry.finishedAt = nowIso();
    }
  }

  // ---- XMLHttpRequest hook --------------------------------------------------
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR(this: XMLHttpRequest): XMLHttpRequest {
    const xhr: XMLHttpRequest = new OrigXHR();
    let entry: DebugTrafficEntry | null = null;
    let reqHeaders: Record<string, string> = {};

    const origOpen = xhr.open;
    xhr.open = function patchedOpen(method: string, url: string | URL): void {
      entry = {
        id: nextId(),
        kind: 'xhr',
        method: method.toUpperCase(),
        url: String(url),
        startedAt: nowIso(),
        finishedAt: null,
        reqHeaders: null,
        reqBody: null,
        status: null,
        statusText: null,
        contentType: null,
        respHeaders: null,
        body: '',
        bodyTruncated: false,
        error: null,
      };
      pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);
      reqHeaders = {};
      // eslint-disable-next-line prefer-rest-params
      return (origOpen as any).apply(xhr, arguments);
    };

    const origSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function patchedSetRequestHeader(name: string, value: string): void {
      reqHeaders[name] = value;
      return origSetRequestHeader.call(xhr, name, value);
    };

    const origSend = xhr.send;
    xhr.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (entry) {
        entry.reqHeaders = { ...reqHeaders };
        try {
          entry.reqBody = body == null ? null : summarize(body);
        } catch (error) {
          entry.reqBody = `(req-body-error: ${String(error)})`;
        }
      }
      xhr.addEventListener('loadend', () => {
        if (!entry) {
          return;
        }
        entry.status = xhr.status;
        entry.statusText = xhr.statusText;
        entry.contentType = xhr.getResponseHeader('content-type');
        try {
          entry.respHeaders = parseHeaderString(xhr.getAllResponseHeaders());
        } catch (error) {
          entry.respHeaders = { _error: String(error) };
        }
        try {
          if (xhr.responseType === '' || xhr.responseType === 'text') {
            const text = xhr.responseText;
            if (text.length > MAX_BODY_BYTES) {
              entry.bodyTruncated = true;
            }
            entry.body = summarize(text);
          } else if (xhr.response != null) {
            entry.body = summarize(xhr.response);
          }
        } catch (error) {
          entry.error = String(error);
        }
        entry.finishedAt = nowIso();
      });
      return origSend.call(xhr, body as XMLHttpRequestBodyInit | null);
    };

    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  (window as unknown as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
    PatchedXHR as unknown as typeof XMLHttpRequest;

  function parseHeaderString(headerString: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!headerString) {
      return result;
    }
    for (const line of headerString.trim().split(/[\r\n]+/)) {
      const idx = line.indexOf(':');
      if (idx < 0) {
        continue;
      }
      const name = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (name) {
        result[name] = value;
      }
    }
    return result;
  }

  // ---- WebSocket hook -------------------------------------------------------
  const OrigWebSocket = window.WebSocket;
  function PatchedWebSocket(url: string | URL, protocols?: string | string[]): WebSocket {
    const target: WebSocket = protocols == null
      ? new OrigWebSocket(url)
      : new OrigWebSocket(url, protocols);
    const messages: Array<Record<string, unknown>> = [];
    const entry: DebugTrafficEntry = {
      id: nextId(),
      kind: 'websocket',
      method: 'WS',
      url: String(url),
      startedAt: nowIso(),
      finishedAt: null,
      reqHeaders: { protocols: protocols ?? null },
      status: null,
      contentType: null,
      respHeaders: null,
      body: '',
      bodyTruncated: false,
      stream: true,
      error: null,
      messages,
    };
    pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);

    target.addEventListener('open', () => messages.push({ at: nowIso(), kind: 'open' }));
    target.addEventListener('close', (event: CloseEvent) => {
      messages.push({ at: nowIso(), kind: 'close', code: event.code, reason: event.reason });
      entry.finishedAt = nowIso();
    });
    target.addEventListener('error', () => {
      messages.push({ at: nowIso(), kind: 'error' });
    });
    target.addEventListener('message', (event: MessageEvent) => {
      const data = summarize(event.data);
      const length = data ? data.length : 0;
      messages.push({
        at: nowIso(),
        kind: 'in',
        length,
        data: data && length <= 8192 ? data : data ? data.slice(0, 8192) + '…' : null,
      });
    });

    const origSend = target.send.bind(target);
    target.send = function patchedSend(payload: string | ArrayBufferLike | Blob | ArrayBufferView): void {
      const data = summarize(payload);
      const length = data ? data.length : 0;
      messages.push({
        at: nowIso(),
        kind: 'out',
        length,
        data: data && length <= 8192 ? data : data ? data.slice(0, 8192) + '…' : null,
      });
      return origSend(payload as string);
    };
    return target;
  }
  PatchedWebSocket.prototype = OrigWebSocket.prototype;
  for (const key of Object.getOwnPropertyNames(OrigWebSocket)) {
    if (!(key in (PatchedWebSocket as unknown as Record<string, unknown>))) {
      try {
        (PatchedWebSocket as unknown as Record<string, unknown>)[key] = (OrigWebSocket as unknown as Record<string, unknown>)[key];
      } catch (error) {
        void error;
      }
    }
  }
  (window as unknown as { WebSocket: typeof WebSocket }).WebSocket = PatchedWebSocket as unknown as typeof WebSocket;

  // ---- EventSource hook -----------------------------------------------------
  const OrigEventSource = window.EventSource;
  if (OrigEventSource) {
    function PatchedEventSource(url: string | URL, init?: EventSourceInit): EventSource {
      const target: EventSource = init == null
        ? new OrigEventSource(url)
        : new OrigEventSource(url, init);
      const messages: Array<Record<string, unknown>> = [];
      const entry: DebugTrafficEntry = {
        id: nextId(),
        kind: 'eventsource',
        method: 'GET',
        url: String(url),
        startedAt: nowIso(),
        finishedAt: null,
        reqHeaders: { withCredentials: init?.withCredentials ?? false },
        status: null,
        contentType: 'text/event-stream',
        respHeaders: null,
        body: '',
        bodyTruncated: false,
        stream: true,
        error: null,
        messages,
      };
      pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);

      target.addEventListener('open', () => messages.push({ at: nowIso(), kind: 'open' }));
      target.addEventListener('error', () => messages.push({ at: nowIso(), kind: 'error' }));
      target.addEventListener('message', (event: MessageEvent) => {
        const data = summarize(event.data);
        const length = data ? data.length : 0;
        messages.push({
          at: nowIso(),
          kind: 'message',
          length,
          data: data && length <= 8192 ? data : data ? data.slice(0, 8192) + '…' : null,
        });
      });
      return target;
    }
    PatchedEventSource.prototype = OrigEventSource.prototype;
    (window as unknown as { EventSource: typeof EventSource }).EventSource = PatchedEventSource as unknown as typeof EventSource;
  }

  // ---- Worker / SharedWorker hooks ------------------------------------------
  const OrigWorker = window.Worker;
  function PatchedWorker(scriptUrl: string | URL, options?: WorkerOptions): Worker {
    const target: Worker = options == null ? new OrigWorker(scriptUrl) : new OrigWorker(scriptUrl, options);
    const messages: Array<Record<string, unknown>> = [];
    const entry: DebugTrafficEntry = {
      id: nextId(),
      kind: 'worker',
      method: 'WORKER',
      url: String(scriptUrl),
      startedAt: nowIso(),
      finishedAt: null,
      reqHeaders: { options: options ?? null },
      status: null,
      contentType: null,
      respHeaders: null,
      body: '',
      stream: true,
      error: null,
      messages,
    };
    pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);

    target.addEventListener('message', (event: MessageEvent) => {
      const data = summarize(event.data);
      messages.push({ at: nowIso(), kind: 'in', length: data ? data.length : 0, data });
    });
    target.addEventListener('error', (event: ErrorEvent) => {
      messages.push({ at: nowIso(), kind: 'error', message: event.message, filename: event.filename });
    });
    const origPost = target.postMessage.bind(target) as (...args: unknown[]) => void;
    (target as unknown as { postMessage: (...args: unknown[]) => void }).postMessage =
      function patchedPostMessage(...args: unknown[]): void {
        const data = summarize(args[0]);
        messages.push({ at: nowIso(), kind: 'out', length: data ? data.length : 0, data });
        return origPost(...args);
      };
    const origTerminate = target.terminate.bind(target);
    target.terminate = function patchedTerminate(): void {
      messages.push({ at: nowIso(), kind: 'terminate' });
      entry.finishedAt = nowIso();
      return origTerminate();
    };
    return target;
  }
  PatchedWorker.prototype = OrigWorker.prototype;
  (window as unknown as { Worker: typeof Worker }).Worker = PatchedWorker as unknown as typeof Worker;

  if (typeof window.SharedWorker === 'function') {
    const OrigSharedWorker = window.SharedWorker;
    function PatchedSharedWorker(scriptUrl: string | URL, options?: string | WorkerOptions): SharedWorker {
      const target: SharedWorker = options == null
        ? new OrigSharedWorker(scriptUrl)
        : new OrigSharedWorker(scriptUrl, options);
      const messages: Array<Record<string, unknown>> = [];
      const entry: DebugTrafficEntry = {
        id: nextId(),
        kind: 'shared-worker',
        method: 'SHARED-WORKER',
        url: String(scriptUrl),
        startedAt: nowIso(),
        finishedAt: null,
        reqHeaders: { options: options ?? null },
        body: '',
        stream: true,
        error: null,
        messages,
      };
      pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);

      target.port.addEventListener('message', (event: MessageEvent) => {
        const data = summarize(event.data);
        messages.push({ at: nowIso(), kind: 'in', length: data ? data.length : 0, data });
      });
      const origPortPost = target.port.postMessage.bind(target.port) as (...args: unknown[]) => void;
      (target.port as unknown as { postMessage: (...args: unknown[]) => void }).postMessage =
        function patchedPortPost(...args: unknown[]): void {
          const data = summarize(args[0]);
          messages.push({ at: nowIso(), kind: 'out', length: data ? data.length : 0, data });
          return origPortPost(...args);
        };
      target.port.start();
      return target;
    }
    PatchedSharedWorker.prototype = OrigSharedWorker.prototype;
    (window as unknown as { SharedWorker: typeof SharedWorker }).SharedWorker =
      PatchedSharedWorker as unknown as typeof SharedWorker;
  }

  // ---- BroadcastChannel hook ------------------------------------------------
  if (typeof window.BroadcastChannel === 'function') {
    const OrigBroadcastChannel = window.BroadcastChannel;
    function PatchedBroadcastChannel(name: string): BroadcastChannel {
      const target: BroadcastChannel = new OrigBroadcastChannel(name);
      const messages: Array<Record<string, unknown>> = [];
      const entry: DebugTrafficEntry = {
        id: nextId(),
        kind: 'broadcast-channel',
        method: 'BROADCAST',
        url: name,
        startedAt: nowIso(),
        finishedAt: null,
        body: '',
        stream: true,
        error: null,
        messages,
      };
      pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);

      target.addEventListener('message', (event: MessageEvent) => {
        const data = summarize(event.data);
        messages.push({ at: nowIso(), kind: 'in', length: data ? data.length : 0, data });
      });
      const origPost = target.postMessage.bind(target);
      target.postMessage = function patchedPostMessage(payload: unknown): void {
        const data = summarize(payload);
        messages.push({ at: nowIso(), kind: 'out', length: data ? data.length : 0, data });
        return origPost(payload);
      };
      return target;
    }
    PatchedBroadcastChannel.prototype = OrigBroadcastChannel.prototype;
    (window as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel =
      PatchedBroadcastChannel as unknown as typeof BroadcastChannel;
  }

  // ---- ServiceWorker messaging ----------------------------------------------
  try {
    if (navigator.serviceWorker) {
      const swEntry: DebugTrafficEntry = {
        id: nextId(),
        kind: 'service-worker',
        method: 'SERVICE-WORKER',
        url: window.location.origin,
        startedAt: nowIso(),
        finishedAt: null,
        body: '',
        stream: true,
        error: null,
        messages: [],
      };
      pushBounded(traffic, swEntry, MAX_TRAFFIC_ENTRIES);

      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        const data = summarize(event.data);
        swEntry.messages?.push({ at: nowIso(), kind: 'in', length: data ? data.length : 0, data });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        swEntry.messages?.push({ at: nowIso(), kind: 'controllerchange' });
      });
    }
  } catch (error) {
    logDebug('warn', 'Failed to attach service-worker listeners', String(error));
  }

  // ---- Navigation hooks -----------------------------------------------------
  function recordNav(kind: string, extra: Record<string, unknown>): void {
    pushBounded(navigation, { at: nowIso(), kind, url: window.location.href, ...extra }, MAX_NAV_ENTRIES);
    const detected = detectChatId();
    if (detected !== currentChatId) {
      const previous = currentChatId;
      currentChatId = detected;
      logDebug('info', `chat changed: ${String(previous)} → ${String(detected)}`);
      if (autoDumpOnChatChange && detected) {
        // Allow the page to settle, then dump.
        window.setTimeout(() => {
          void dump(`auto-${detected}`, { includeDom: true });
        }, 1500);
      }
    }
  }
  const origPushState = history.pushState.bind(history);
  history.pushState = function patchedPushState(...args: Parameters<History['pushState']>): void {
    const result = origPushState(...args);
    recordNav('pushState', {});
    return result;
  };
  const origReplaceState = history.replaceState.bind(history);
  history.replaceState = function patchedReplaceState(...args: Parameters<History['replaceState']>): void {
    const result = origReplaceState(...args);
    recordNav('replaceState', {});
    return result;
  };
  window.addEventListener('popstate', () => recordNav('popstate', {}));
  window.addEventListener('hashchange', () => recordNav('hashchange', {}));
  recordNav('install', {});

  // ---- Console mirror -------------------------------------------------------
  for (const level of ['log', 'warn', 'error'] as const) {
    const orig = console[level].bind(console);
    console[level] = function patchedConsole(...args: unknown[]): void {
      try {
        pushBounded(
          consoleEvents,
          {
            at: nowIso(),
            level,
            message: args
              .map((arg) => {
                try {
                  return typeof arg === 'string' ? arg : JSON.stringify(arg);
                } catch {
                  return String(arg);
                }
              })
              .join(' ')
              .slice(0, 8000),
          },
          400,
        );
      } catch (error) {
        void error;
      }
      return orig(...args);
    };
  }

  // ---- DOM / SW snapshot helpers --------------------------------------------
  function captureDom(): { truncated: boolean; length: number; html: string } {
    try {
      const html = document.documentElement?.outerHTML ?? '';
      if (html.length > MAX_DOM_BYTES) {
        return { truncated: true, length: html.length, html: html.slice(0, MAX_DOM_BYTES) };
      }
      return { truncated: false, length: html.length, html };
    } catch (error) {
      return { truncated: false, length: 0, html: `(dom-error: ${String(error)})` };
    }
  }

  async function captureServiceWorkers(): Promise<Array<Record<string, unknown>>> {
    try {
      if (!navigator.serviceWorker) {
        return [];
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.map((reg) => ({
        scope: reg.scope,
        active: reg.active ? { scriptURL: reg.active.scriptURL, state: reg.active.state } : null,
        waiting: reg.waiting ? { scriptURL: reg.waiting.scriptURL, state: reg.waiting.state } : null,
        installing: reg.installing ? { scriptURL: reg.installing.scriptURL, state: reg.installing.state } : null,
      }));
    } catch (error) {
      return [{ error: String(error) }];
    }
  }

  function captureResourceTimings(): Array<Record<string, unknown>> {
    try {
      return performance.getEntriesByType('resource').slice(-300).map((rawEntry) => {
        const e = rawEntry as PerformanceResourceTiming;
        return {
          name: e.name,
          initiatorType: e.initiatorType,
          startTime: e.startTime,
          duration: e.duration,
          transferSize: e.transferSize,
          responseStart: e.responseStart,
          encodedBodySize: e.encodedBodySize,
        };
      });
    } catch (error) {
      return [{ error: String(error) }];
    }
  }

  // ---- Dump -----------------------------------------------------------------
  async function buildSnapshot(tag: string, options: DumpOptions): Promise<Record<string, unknown>> {
    const includeDom = options.includeDom !== false;
    const includeResourceTimings = options.includeResourceTimings !== false;
    const includeServiceWorkers = options.includeServiceWorkers !== false;

    return {
      capturedAt: nowIso(),
      tag,
      url: window.location.href,
      title: document.title,
      currentChatId,
      cookies: document.cookie,
      userAgent: navigator.userAgent,
      navigation: navigation.slice(),
      traffic: traffic.slice(),
      consoleEvents: consoleEvents.slice(),
      serviceWorkers: includeServiceWorkers ? await captureServiceWorkers() : [],
      resourceTimings: includeResourceTimings ? captureResourceTimings() : [],
      dom: includeDom ? captureDom() : null,
    };
  }

  async function dump(tag?: string, options: DumpOptions = {}): Promise<void> {
    const snapshot = await buildSnapshot(tag || 'snapshot', options);
    postChannel(SOURCE, snapshot);
    logDebug(
      'info',
      `dumped tag=${snapshot.tag as string} traffic=${String((snapshot.traffic as unknown[]).length)} dom=${snapshot.dom ? 'yes' : 'no'}`,
    );
  }

  // ---- Floating overlay (capture button + indicator) ------------------------
  function ensureOverlay(): void {
    try {
      const id = '__chatcap_overlay';
      if (document.getElementById(id)) {
        return;
      }
      if (!document.body) {
        return;
      }
      const root = document.createElement('div');
      root.id = id;
      root.style.cssText = [
        'position:fixed', 'right:12px', 'bottom:12px', 'z-index:2147483647',
        'display:flex', 'gap:8px', 'flex-direction:column', 'align-items:flex-end',
        'pointer-events:none', 'font:12px ui-sans-serif,system-ui,sans-serif',
      ].join(';');

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Capture';
      button.title = 'chatcap: dump full snapshot now (Ctrl+Shift+D)';
      button.style.cssText = [
        'pointer-events:auto', 'padding:6px 12px', 'border-radius:8px', 'border:1px solid #5b87cc',
        'background:rgba(20,30,55,0.85)', 'color:#fff', 'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,0.3)',
      ].join(';');
      button.addEventListener('click', () => {
        button.textContent = 'Dumping…';
        button.disabled = true;
        void dump('manual', { includeDom: true })
          .then(() => {
            button.textContent = 'Dumped ✓';
          })
          .catch(() => {
            button.textContent = 'Failed';
          })
          .finally(() => {
            window.setTimeout(() => {
              button.textContent = 'Capture';
              button.disabled = false;
            }, 1400);
          });
      });
      root.append(button);
      document.body.append(root);
    } catch (error) {
      logDebug('warn', 'overlay-init failed', String(error));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureOverlay(), { once: true });
  } else {
    ensureOverlay();
  }

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
      event.preventDefault();
      void dump('hotkey', { includeDom: true });
    }
  });

  // ---- Public API -----------------------------------------------------------
  (window as unknown as { __chatcap: Record<string, unknown> }).__chatcap = {
    installed: true,
    version: 1,
    dump,
    snapshot: buildSnapshot,
    traffic,
    navigation,
    consoleEvents,
    detectChatId,
    setAutoDump(enabled: boolean) {
      autoDumpOnChatChange = Boolean(enabled);
      logDebug('info', `auto-dump on chat change = ${String(autoDumpOnChatChange)}`);
    },
    tail(count = 15) {
      const slice = traffic.slice(-count);
      console.table(
        slice.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          method: entry.method,
          url: entry.url.length > 80 ? `${entry.url.slice(0, 77)}…` : entry.url,
          status: entry.status,
          contentType: entry.contentType,
          stream: entry.stream || false,
          messages: entry.messages ? entry.messages.length : undefined,
          error: entry.error || '',
        })),
      );
    },
    clear() {
      traffic.length = 0;
      navigation.length = 0;
      consoleEvents.length = 0;
      counter = 0;
    },
    find(needle: string) {
      const lower = String(needle).toLowerCase();
      return traffic.filter((entry) => entry.url.toLowerCase().includes(lower));
    },
  };

  logDebug('info', 'debug-capture installed (use Capture button, Ctrl+Shift+D, or __chatcap.dump())');
})();
