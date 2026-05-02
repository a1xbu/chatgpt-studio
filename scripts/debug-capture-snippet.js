/* eslint-disable */
// chatcap — paste the entire IIFE below into the DevTools console of the chatgpt.com tab.
// Firefox blocks console paste by default: type `allow pasting` (without quotes) and Enter
// once before pasting. The snippet survives SPA navigation; navigate from project to the
// broken chat AFTER installing it, then call __chatcap.dump('any-tag') to ship the dump
// to the local capture-server (scripts/debug-capture-server.mjs) running on port 4781.

(() => {
  if (window.__chatcap && window.__chatcap.installed) {
    console.log('%c[chatcap]', 'color:#a8c7ff', 'already installed; use __chatcap.dump("tag")');
    return window.__chatcap;
  }

  const ENDPOINT = (window.__chatcapEndpoint || 'http://127.0.0.1:4781/');
  const MAX_BODY_BYTES = 6 * 1024 * 1024; // 6 MB per request/response capture
  const MAX_TRAFFIC_ENTRIES = 800;        // ring buffer
  const MAX_NAV_ENTRIES = 200;
  const MAX_DOM_BYTES = 4 * 1024 * 1024;  // truncate huge DOMs

  const log = (...a) => console.log('%c[chatcap]', 'color:#a8c7ff', ...a);
  const warn = (...a) => console.warn('%c[chatcap]', 'color:#f7a76b', ...a);

  const traffic = [];
  const navigation = [];
  const consoleEvents = [];
  let counter = 0;
  let currentChatId = detectChatId();

  function nextId() { counter += 1; return counter; }
  function ts() { return new Date().toISOString(); }

  function detectChatId() {
    const m = location.pathname.match(/\/c\/([0-9a-f-]{8,})/i);
    return m ? m[1] : null;
  }

  function pushBounded(bucket, entry, limit) {
    bucket.push(entry);
    if (bucket.length > limit) {
      bucket.splice(0, bucket.length - limit);
    }
  }

  function summarize(value) {
    if (value == null) return null;
    let text;
    try {
      if (typeof value === 'string') {
        text = value;
      } else if (value instanceof ArrayBuffer) {
        text = `(ArrayBuffer ${value.byteLength} bytes)`;
      } else if (ArrayBuffer.isView(value)) {
        text = `(${value.constructor.name} ${value.byteLength} bytes)`;
      } else if (value instanceof Blob) {
        text = `(Blob ${value.size} bytes type=${value.type || 'unknown'})`;
      } else if (value instanceof FormData) {
        const parts = [];
        for (const [k, v] of value.entries()) {
          parts.push(`${k}=${typeof v === 'string' ? v : `(File ${v.name || ''} ${v.size} bytes)`}`);
        }
        text = `(FormData ${parts.join('&')})`;
      } else if (value instanceof URLSearchParams) {
        text = value.toString();
      } else {
        text = String(value);
      }
    } catch (error) {
      text = `(summarize-error: ${String(error)})`;
    }
    if (text.length > MAX_BODY_BYTES) {
      return text.slice(0, MAX_BODY_BYTES) + `\n…[truncated ${text.length - MAX_BODY_BYTES} bytes]`;
    }
    return text;
  }

  // ---- fetch hook -------------------------------------------------------
  const origFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init) {
    const id = nextId();
    let url;
    let method;
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
    const entry = {
      id, kind: 'fetch', method: String(method).toUpperCase(), url,
      startedAt: ts(), reqHeaders: serializeHeaders(init, input),
      reqBody: await readRequestBody(input, init),
      status: null, statusText: null, contentType: null, respHeaders: null,
      body: '', bodyTruncated: false, finishedAt: null, error: null, stream: false,
    };
    pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);
    try {
      const response = await origFetch(input, init);
      entry.status = response.status;
      entry.statusText = response.statusText;
      entry.contentType = response.headers.get('content-type');
      entry.respHeaders = headersToObject(response.headers);
      const cloned = response.clone();
      const isStream = entry.contentType && entry.contentType.includes('text/event-stream');
      if (isStream) {
        entry.stream = true;
        readStreamingResponse(cloned, entry);
      } else {
        cloned.text().then((text) => {
          if (text.length > MAX_BODY_BYTES) entry.bodyTruncated = true;
          entry.body = summarize(text);
          entry.finishedAt = ts();
        }).catch((error) => {
          entry.error = String(error);
          entry.finishedAt = ts();
        });
      }
      return response;
    } catch (error) {
      entry.error = String(error);
      entry.finishedAt = ts();
      throw error;
    }
  };

  function serializeHeaders(init, input) {
    try {
      if (init && init.headers) {
        if (init.headers instanceof Headers) return headersToObject(init.headers);
        if (Array.isArray(init.headers)) return Object.fromEntries(init.headers);
        return { ...init.headers };
      }
      if (input instanceof Request) return headersToObject(input.headers);
    } catch (_) { /* ignore */ }
    return null;
  }

  function headersToObject(headers) {
    const result = {};
    try {
      headers.forEach((value, key) => { result[key] = value; });
    } catch (_) { /* ignore */ }
    return result;
  }

  async function readRequestBody(input, init) {
    try {
      if (init && init.body !== undefined) return summarize(init.body);
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

  async function readStreamingResponse(response, entry) {
    try {
      if (!response.body) {
        entry.body = '(no-readable-body)';
        entry.finishedAt = ts();
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (acc.length > MAX_BODY_BYTES) {
          entry.bodyTruncated = true;
          acc = acc.slice(0, MAX_BODY_BYTES);
          break;
        }
      }
      entry.body = summarize(acc);
      entry.finishedAt = ts();
    } catch (error) {
      entry.error = String(error);
      entry.finishedAt = ts();
    }
  }

  // ---- XMLHttpRequest hook ---------------------------------------------
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let entry = null;
    let reqHeaders = {};

    const origOpen = xhr.open;
    xhr.open = function patchedOpen(method, url, async, user, password) {
      entry = {
        id: nextId(), kind: 'xhr', method: String(method).toUpperCase(), url: String(url),
        startedAt: ts(), reqHeaders: null, reqBody: null,
        status: null, statusText: null, contentType: null, respHeaders: null,
        body: '', bodyTruncated: false, finishedAt: null, error: null, stream: false,
      };
      pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);
      reqHeaders = {};
      return origOpen.call(xhr, method, url, async, user, password);
    };

    const origSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function patchedSetRequestHeader(name, value) {
      reqHeaders[name] = value;
      return origSetRequestHeader.call(xhr, name, value);
    };

    const origSend = xhr.send;
    xhr.send = function patchedSend(body) {
      if (entry) {
        entry.reqHeaders = { ...reqHeaders };
        try { entry.reqBody = summarize(body == null ? null : body); } catch (_) { /* ignore */ }
      }
      xhr.addEventListener('loadend', () => {
        if (!entry) return;
        entry.status = xhr.status;
        entry.statusText = xhr.statusText;
        entry.contentType = xhr.getResponseHeader('content-type');
        try {
          entry.respHeaders = parseHeaderString(xhr.getAllResponseHeaders());
        } catch (_) { /* ignore */ }
        try {
          const text = xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : null;
          if (text != null) {
            if (text.length > MAX_BODY_BYTES) entry.bodyTruncated = true;
            entry.body = summarize(text);
          } else if (xhr.response != null) {
            entry.body = summarize(xhr.response);
          }
        } catch (error) {
          entry.error = String(error);
        }
        entry.finishedAt = ts();
      });
      return origSend.call(xhr, body);
    };

    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  function parseHeaderString(headerString) {
    const result = {};
    if (!headerString) return result;
    for (const line of headerString.trim().split(/[\r\n]+/)) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const name = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (name) result[name] = value;
    }
    return result;
  }

  // ---- WebSocket hook --------------------------------------------------
  const OrigWebSocket = window.WebSocket;
  function PatchedWebSocket(url, protocols) {
    const ws = protocols == null ? new OrigWebSocket(url) : new OrigWebSocket(url, protocols);
    const entry = {
      id: nextId(), kind: 'websocket', method: 'WS', url: String(url),
      startedAt: ts(), reqHeaders: { protocols: protocols ?? null }, reqBody: null,
      status: null, statusText: null, contentType: null, respHeaders: null,
      body: '', bodyTruncated: false, finishedAt: null, error: null, stream: true,
      messages: [],
    };
    pushBounded(traffic, entry, MAX_TRAFFIC_ENTRIES);

    ws.addEventListener('open', () => entry.messages.push({ at: ts(), kind: 'open' }));
    ws.addEventListener('close', (event) => {
      entry.messages.push({ at: ts(), kind: 'close', code: event.code, reason: event.reason });
      entry.finishedAt = ts();
    });
    ws.addEventListener('error', (event) => {
      entry.messages.push({ at: ts(), kind: 'error' });
    });
    ws.addEventListener('message', (event) => {
      const data = event.data;
      const value = summarize(data);
      const len = value ? value.length : 0;
      entry.messages.push({ at: ts(), kind: 'in', length: len, data: len <= 4096 ? value : value.slice(0, 4096) + '…' });
    });
    const origSend = ws.send.bind(ws);
    ws.send = function patchedSend(payload) {
      const value = summarize(payload);
      const len = value ? value.length : 0;
      entry.messages.push({ at: ts(), kind: 'out', length: len, data: len <= 4096 ? value : value.slice(0, 4096) + '…' });
      return origSend(payload);
    };
    return ws;
  }
  PatchedWebSocket.prototype = OrigWebSocket.prototype;
  for (const key of Object.getOwnPropertyNames(OrigWebSocket)) {
    if (!(key in PatchedWebSocket)) {
      try { PatchedWebSocket[key] = OrigWebSocket[key]; } catch (_) { /* ignore */ }
    }
  }
  window.WebSocket = PatchedWebSocket;

  // ---- Navigation hooks -----------------------------------------------
  function recordNav(kind, extra) {
    pushBounded(navigation, { at: ts(), kind, url: location.href, ...extra }, MAX_NAV_ENTRIES);
    const newChatId = detectChatId();
    if (newChatId !== currentChatId) {
      currentChatId = newChatId;
      log('chat changed →', newChatId, '(call __chatcap.dump("after-nav") to save)');
    }
  }
  const origPushState = history.pushState;
  history.pushState = function patchedPushState() {
    const result = origPushState.apply(this, arguments);
    recordNav('pushState', {});
    return result;
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function patchedReplaceState() {
    const result = origReplaceState.apply(this, arguments);
    recordNav('replaceState', {});
    return result;
  };
  window.addEventListener('popstate', () => recordNav('popstate', {}));
  window.addEventListener('hashchange', () => recordNav('hashchange', {}));
  recordNav('install', {});

  // ---- Console mirror (lightweight) -----------------------------------
  for (const level of ['log', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = function patchedConsole(...args) {
      try {
        pushBounded(consoleEvents, {
          at: ts(),
          level,
          message: args.map((arg) => {
            try { return typeof arg === 'string' ? arg : JSON.stringify(arg); }
            catch (_) { return String(arg); }
          }).join(' ').slice(0, 8000),
        }, 400);
      } catch (_) { /* ignore */ }
      return orig(...args);
    };
  }

  // ---- DOM snapshot ----------------------------------------------------
  function captureDom() {
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

  async function captureServiceWorkers() {
    try {
      if (!navigator.serviceWorker) return [];
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

  function captureResourceTimings() {
    try {
      return performance.getEntriesByType('resource').slice(-200).map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        duration: entry.duration,
        transferSize: entry.transferSize,
        responseStart: entry.responseStart,
      }));
    } catch (error) {
      return [{ error: String(error) }];
    }
  }

  async function snapshot(tag) {
    const dom = captureDom();
    const serviceWorkers = await captureServiceWorkers();
    return {
      capturedAt: ts(),
      tag: tag || 'snapshot',
      url: location.href,
      title: document.title,
      currentChatId,
      cookies: document.cookie,
      userAgent: navigator.userAgent,
      navigation: navigation.slice(),
      traffic: traffic.slice(),
      consoleEvents: consoleEvents.slice(),
      serviceWorkers,
      resourceTimings: captureResourceTimings(),
      dom,
    };
  }

  async function dump(tag) {
    const data = await snapshot(tag);
    const json = JSON.stringify(data);
    log(`dumping ${json.length.toLocaleString()} bytes (tag=${data.tag}, traffic=${data.traffic.length}, nav=${data.navigation.length})`);
    try {
      const response = await origFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Capture-Tag': data.tag },
        body: json,
      });
      const result = await response.json();
      log('saved →', result.path ?? result.fileName ?? '(server returned no path)');
      return result;
    } catch (error) {
      warn('post failed:', error);
      warn('JSON below — copy it manually:');
      console.log('%c[chatcap-data-begin]', 'color:#7ef0c4');
      console.log(json);
      console.log('%c[chatcap-data-end]', 'color:#7ef0c4');
      throw error;
    }
  }

  function tail(count) {
    const slice = traffic.slice(-(count ?? 15));
    console.table(slice.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      method: entry.method,
      url: entry.url.length > 80 ? entry.url.slice(0, 77) + '…' : entry.url,
      status: entry.status,
      contentType: entry.contentType,
      bodyLen: entry.body ? entry.body.length : 0,
      stream: entry.stream || false,
      err: entry.error || '',
    })));
  }

  function clear() {
    traffic.length = 0;
    navigation.length = 0;
    consoleEvents.length = 0;
    counter = 0;
    log('buffers cleared');
  }

  function find(substring) {
    const needle = String(substring).toLowerCase();
    return traffic.filter((entry) => entry.url.toLowerCase().includes(needle));
  }

  window.__chatcap = {
    installed: true,
    version: 1,
    endpoint: ENDPOINT,
    setEndpoint(value) { window.__chatcapEndpoint = value; this.endpoint = value; },
    dump,
    snapshot,
    tail,
    clear,
    find,
    traffic,
    navigation,
    consoleEvents,
    detectChatId,
  };

  log('installed. Workflow:');
  log('  1) start the capture-server: npm run debug:capture (or node scripts/debug-capture-server.mjs)');
  log('  2) navigate to the broken chat in this tab');
  log('  3) call __chatcap.dump("any-tag") to ship a dump');
  log('  4) inspect dumps under <repo>/.chatgpt-capture/');
  log('utility: __chatcap.tail()  __chatcap.find("backend-api/conversation")  __chatcap.clear()');
  return window.__chatcap;
})();
