(function bootstrapInjectedChatGptTracker() {
  type DebugLevel = 'info' | 'warn' | 'error';
  type ChatNameSource = 'project-list' | 'snapshot';
  type ProjectNameSource = 'response' | 'request-title';
  type ChatHistoryMessageRole = 'assistant' | 'system' | 'tool' | 'user' | 'unknown';
  type ChatHistoryReasoningStep = {
    summary: string | null;
    content: string;
    chunks: string[];
  };
  type ChatHistoryMultimodalPart = {
    kind: 'text' | 'image' | 'attachment' | 'unknown';
    text: string | null;
    assetPointer?: string | null;
    mimeType?: string | null;
    width?: number | null;
    height?: number | null;
  };
  type ExtractedChatHistoryMessage = {
    messageId: string | null;
    nodeId: string | null;
    parentMessageId: string | null;
    turnId: string | null;
    role: ChatHistoryMessageRole;
    authorName: string | null;
    modelSlug: string | null;
    text: string;
    createdAt: string | null;
    updatedAt: string | null;
    contentType: string | null;
    messageType: string | null;
    language: string | null;
    parts: ChatHistoryMultimodalPart[] | null;
    children: string[] | null;
    isHidden: boolean;
    endTurn: boolean | null;
    status: string | null;
    reasoning: {
      recap: string;
      finishedDurationSec: number | null;
      startedAt: string | null;
      endedAt: string | null;
      steps: ChatHistoryReasoningStep[];
      stepsLoaded: boolean;
    } | null;
    metadataJson: string | null;
    rawJson: string | null;
  };
  type HeaderEntries = Array<[string, unknown]>;
  type TrackedXmlHttpRequest = XMLHttpRequest & {
    __chatgptDesktopPocUrl?: string;
    __chatgptDesktopPocProjectIdHint?: string | null;
    __chatgptDesktopPocConversationIdHint?: string | null;
  };
  type StreamContext = {
    anonymousMessageSequence: number;
    conversationId: string | null;
    currentCreatedAt: string | null;
    currentMessageId: string | null;
    currentMessageKey: string | null;
    currentRole: ChatHistoryMessageRole;
    currentUpdatedAt: string | null;
    emitTimer: number | null;
    messagesByKey: Map<
      string,
      {
        createdAt: string | null;
        messageId: string | null;
        role: ChatHistoryMessageRole;
        text: string;
        updatedAt: string | null;
      }
    >;
    messageFieldBuffers: Map<string, string>;
    sseBuffer: string;
  };

  const injectedWindow = window as Window & {
    __chatgptDesktopPocInstalled?: boolean;
  };

  if (injectedWindow.__chatgptDesktopPocInstalled) {
    return;
  }

  injectedWindow.__chatgptDesktopPocInstalled = true;

  const PAGE_CONTEXT_MESSAGE_SOURCE = 'chatgpt-desktop-poc:page-context';
  const PAGE_DEBUG_MESSAGE_SOURCE = 'chatgpt-desktop-poc:debug';
  const PAGE_HISTORY_MESSAGE_SOURCE = 'chatgpt-desktop-poc:conversation-history';
  const PAGE_APP_REQUEST_MESSAGE_SOURCE = 'chatgpt-desktop-poc:app-request';
  const PAGE_APP_RESPONSE_MESSAGE_SOURCE = 'chatgpt-desktop-poc:app-response';
  const PAGE_APP_COMMAND_MESSAGE_SOURCE = 'chatgpt-desktop-poc:app-command';
  const PAGE_FILE_STATUS_MESSAGE_SOURCE = 'chatgpt-desktop-poc:file-status';
  const SNAPSHOT_URL_PATTERN = /^\/backend-api\/conversation\/([^/?#]+)\/?$/;
  const PROJECT_CONVERSATIONS_URL_PATTERN = /^\/backend-api\/gizmos\/(g-p-[^/?#]+)\/conversations(?:[/?#]|$)/;
  const LIVE_STREAM_URL_PATTERN = /\/backend-api\/f\/conversation(?:[/?#]|$)/;
  const STREAM_CONVERSATION_ID_PATTERN = /"conversation_id"\s*:\s*"([^"]+)"/;
  const DECORATED_CHAT_TITLE_PATTERN = /^branch\s*[·:-]\s*/i;
  const SANDBOX_MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\((sandbox:\/mnt\/data\/[^)\s"'<>`]+)\)/g;
  const SANDBOX_BARE_PATH_PATTERN = /sandbox:\/mnt\/data\/[^\s)\]"'<>`]+/g;
  const MAX_TRACKED_FIELD_LENGTH = 4096;

  let emitTimer: number | null = null;
  let lastSignature = '';

  const knownChatNames = new Map<string, string>();
  const knownChatNameSources = new Map<string, ChatNameSource>();
  const knownProjectNames = new Map<string, string>();
  const knownProjectNameSources = new Map<string, ProjectNameSource>();
  const knownConversationProjectIds = new Map<string, string>();
  const pendingConversationProjectIds = new Map<string, string>();
  const pendingAppBridgeRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  const knownSandboxFilesByKey = new Map<string, {
    projectId: string;
    projectName: string | null;
    chatId: string;
    messageId: string;
    sandboxPath: string;
    downloadPath: string | null;
    discoveredAt: string;
    updatedAt: string;
  }>();
  const knownSandboxFilesByChatPath = new Map<string, {
    projectId: string;
    projectName: string | null;
    chatId: string;
    messageId: string;
    sandboxPath: string;
    downloadPath: string | null;
    discoveredAt: string;
    updatedAt: string;
  }>();
  const authState = { authorization: null as string | null };
  const capturedBackendHeaders: Record<string, string> = {};
  let appBridgeSequence = 0;
  const sandboxDownloadQueue: string[] = [];
  const sandboxDownloadStatuses = new Map<string, {
    status: 'waiting' | 'resolving' | 'downloading' | 'saving' | 'downloaded' | 'cancelled' | 'error';
    progressPercent: number | null;
    message: string | null;
    updatedAt: string;
  }>();
  let currentSandboxDownloadKey: string | null = null;
  let currentSandboxDownloadAbortController: AbortController | null = null;
  let nextSandboxDownloadTimer: number | null = null;

  const originalConsole = {
    error: console.error.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
  };

  function cleanupText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function normalizeOptionalText(value: unknown): string | null {
    const normalized = cleanupText(value);
    return normalized || null;
  }

  function normalizeChatTimestampToIso(value: unknown): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    const milliseconds = value > 1_000_000_000_000 ? Math.round(value) : Math.round(value * 1000);
    return new Date(milliseconds).toISOString();
  }

  function normalizeMessageRole(value: unknown): ChatHistoryMessageRole {
    return value === 'assistant' || value === 'system' || value === 'tool' || value === 'user' ? value : 'unknown';
  }

  function normalizePreviewText(value: string): string {
    return value
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function sanitizeSandboxPath(value: unknown): string | null {
    const normalized = cleanupText(value).replace(/[)\],.;:]+$/, '');
    return normalized.startsWith('sandbox:/') ? normalized : null;
  }

  function normalizeSandboxPath(value: string): string | null {
    const sanitized = sanitizeSandboxPath(value);
    if (!sanitized) {
      return null;
    }

    const normalized = sanitized.slice('sandbox:'.length);
    return normalized.startsWith('/mnt/data/') ? normalized : null;
  }

  function collectSandboxPathMatch(rawValue: string | null | undefined, seenPaths: Set<string>, target: string[]): void {
    const normalizedPath = rawValue ? normalizeSandboxPath(rawValue) : null;
    if (!normalizedPath || normalizedPath.endsWith('/') || seenPaths.has(normalizedPath)) {
      return;
    }

    seenPaths.add(normalizedPath);
    target.push(normalizedPath);
  }

  function extractSandboxPaths(value: unknown): string[] {
    const sourceText = String(value ?? '');
    const seenPaths = new Set<string>();
    const paths: string[] = [];

    SANDBOX_MARKDOWN_LINK_PATTERN.lastIndex = 0;
    let match = SANDBOX_MARKDOWN_LINK_PATTERN.exec(sourceText);
    while (match) {
      collectSandboxPathMatch(match[1] ?? match[0], seenPaths, paths);
      match = SANDBOX_MARKDOWN_LINK_PATTERN.exec(sourceText);
    }

    SANDBOX_BARE_PATH_PATTERN.lastIndex = 0;
    match = SANDBOX_BARE_PATH_PATTERN.exec(sourceText);
    while (match) {
      collectSandboxPathMatch(match[0], seenPaths, paths);
      match = SANDBOX_BARE_PATH_PATTERN.exec(sourceText);
    }

    return paths;
  }


  function getSandboxFileKey(chatId: string, messageId: string, sandboxPath: string): string {
    return `${cleanupText(chatId)}::${cleanupText(messageId)}::${cleanupText(sandboxPath)}`;
  }

  function getSandboxChatPathKey(chatId: string, sandboxPath: string): string {
    return `${cleanupText(chatId)}::${cleanupText(sandboxPath)}`;
  }

  function getSandboxFileName(sandboxPath: string): string {
    const segments = sandboxPath.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? 'downloaded-file';
  }

  function collectTextFragments(value: unknown, target: string[], depth = 0): void {
    if (depth > 4 || value == null) {
      return;
    }

    if (typeof value === 'string') {
      const normalized = normalizePreviewText(value);
      if (normalized) {
        target.push(normalized);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        collectTextFragments(entry, target, depth + 1);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    if (typeof value.text === 'string') {
      collectTextFragments(value.text, target, depth + 1);
    }

    if (typeof value.content === 'string') {
      collectTextFragments(value.content, target, depth + 1);
    }

    if (Array.isArray(value.parts)) {
      collectTextFragments(value.parts, target, depth + 1);
    }
  }

  function extractMessageText(message: Record<string, unknown>): string | null {
    const fragments: string[] = [];
    const content = isRecord(message.content) ? message.content : null;
    if (content) {
      if (typeof content.text === 'string') {
        collectTextFragments(content.text, fragments);
      }

      if (typeof content.content === 'string') {
        collectTextFragments(content.content, fragments);
      }

      if (typeof content.summary === 'string') {
        collectTextFragments(content.summary, fragments);
      }

      if (typeof content.result === 'string') {
        collectTextFragments(content.result, fragments);
      }

      if (Array.isArray(content.parts)) {
        collectTextFragments(content.parts, fragments);
      }
    }

    if (!fragments.length) {
      return null;
    }

    return normalizePreviewText(Array.from(new Set(fragments)).join('\n\n')) || null;
  }

  function extractMultimodalParts(message: Record<string, unknown>): ChatHistoryMultimodalPart[] | null {
    const content = isRecord(message.content) ? message.content : null;
    if (!content || !Array.isArray(content.parts) || !content.parts.length) {
      return null;
    }

    const parts: ChatHistoryMultimodalPart[] = [];
    for (const rawPart of content.parts) {
      if (typeof rawPart === 'string') {
        const normalized = normalizePreviewText(rawPart);
        if (normalized) {
          parts.push({ kind: 'text', text: normalized });
        }
        continue;
      }

      if (!isRecord(rawPart)) {
        continue;
      }

      const partType = typeof rawPart.content_type === 'string' ? cleanupText(rawPart.content_type) : '';
      const assetPointer =
        typeof rawPart.asset_pointer === 'string'
          ? cleanupText(rawPart.asset_pointer)
          : typeof rawPart.image_url === 'string'
            ? cleanupText(rawPart.image_url)
            : null;
      const mimeType = typeof rawPart.mime_type === 'string' ? cleanupText(rawPart.mime_type) : null;
      const width = typeof rawPart.width === 'number' && Number.isFinite(rawPart.width) ? rawPart.width : null;
      const height = typeof rawPart.height === 'number' && Number.isFinite(rawPart.height) ? rawPart.height : null;
      const inlineText = typeof rawPart.text === 'string' ? normalizePreviewText(rawPart.text) : null;

      let kind: ChatHistoryMultimodalPart['kind'] = 'unknown';
      if (partType.startsWith('image_asset_pointer') || partType === 'image' || (mimeType ?? '').startsWith('image/')) {
        kind = 'image';
      } else if (partType === 'real_time_user_audio_video_asset_pointer' || partType === 'audio_asset_pointer') {
        kind = 'attachment';
      } else if (assetPointer) {
        kind = 'attachment';
      } else if (inlineText) {
        kind = 'text';
      }

      parts.push({
        kind,
        text: inlineText ?? null,
        assetPointer: assetPointer ?? null,
        mimeType: mimeType ?? null,
        width: width ?? null,
        height: height ?? null,
      });
    }

    return parts.length ? parts : null;
  }

  function extractCodeMessage(message: Record<string, unknown>): { text: string; language: string | null } {
    const content = isRecord(message.content) ? message.content : null;
    const text = typeof content?.text === 'string' ? normalizePreviewText(content.text) : '';
    const language = content && typeof content.language === 'string' ? cleanupText(content.language) || null : null;
    return { text, language: language && language !== 'unknown' ? language : null };
  }

  function extractExecutionOutputText(message: Record<string, unknown>): string {
    const content = isRecord(message.content) ? message.content : null;
    if (!content) {
      return '';
    }

    const fragments: string[] = [];
    if (typeof content.text === 'string') {
      collectTextFragments(content.text, fragments);
    }
    if (Array.isArray(content.parts)) {
      collectTextFragments(content.parts, fragments);
    }
    if (typeof content.result === 'string') {
      collectTextFragments(content.result, fragments);
    }
    return fragments.length ? normalizePreviewText(Array.from(new Set(fragments)).join('\n\n')) : '';
  }

  function extractReasoningMetadata(metadata: Record<string, unknown> | null): {
    finishedDurationSec: number | null;
    startedAt: string | null;
    endedAt: string | null;
  } {
    if (!metadata) {
      return { finishedDurationSec: null, startedAt: null, endedAt: null };
    }

    const finishedDurationSec =
      typeof metadata.finished_duration_sec === 'number' && Number.isFinite(metadata.finished_duration_sec)
        ? metadata.finished_duration_sec
        : null;
    const startedAt =
      typeof metadata.reasoning_start_time === 'number' || typeof metadata.reasoning_start_time === 'string'
        ? normalizeChatTimestampToIso(metadata.reasoning_start_time)
        : null;
    const endedAt =
      typeof metadata.reasoning_end_time === 'number' || typeof metadata.reasoning_end_time === 'string'
        ? normalizeChatTimestampToIso(metadata.reasoning_end_time)
        : null;
    return { finishedDurationSec, startedAt, endedAt };
  }

  const PRESERVED_METADATA_KEYS = new Set<string>([
    'message_type',
    'finished_duration_sec',
    'reasoning_status',
    'reasoning_start_time',
    'reasoning_end_time',
    'reasoning_title',
    'turn_exchange_id',
    'parent_id',
    'model_slug',
    'thinking_effort',
    'classifier_response',
    'citations',
    'content_references',
    'aggregate_result',
    'command',
    'is_visually_hidden_from_conversation',
    'attachments',
    'finish_details',
    'is_complete',
  ]);

  function extractPreservedMetadataJson(metadata: Record<string, unknown> | null): string | null {
    if (!metadata) {
      return null;
    }

    const preserved: Record<string, unknown> = {};
    for (const key of Object.keys(metadata)) {
      if (PRESERVED_METADATA_KEYS.has(key)) {
        preserved[key] = (metadata as Record<string, unknown>)[key];
      }
    }

    if (!Object.keys(preserved).length) {
      return null;
    }

    try {
      return JSON.stringify(preserved);
    } catch {
      return null;
    }
  }

  function safeStringifyJson(value: unknown): string | null {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  function extractStringList(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const list = value
      .map((entry) => (typeof entry === 'string' ? cleanupText(entry) : ''))
      .filter((entry): entry is string => Boolean(entry));
    return list.length ? list : [];
  }

  function extractReasoningSteps(message: Record<string, unknown>): ChatHistoryReasoningStep[] {
    const content = isRecord(message.content) ? message.content : null;
    const rawThoughts = content && Array.isArray(content.thoughts) ? content.thoughts : [];
    const steps: ChatHistoryReasoningStep[] = [];

    for (const rawThought of rawThoughts) {
      if (!isRecord(rawThought)) {
        continue;
      }

      const chunks = Array.isArray(rawThought.chunks)
        ? rawThought.chunks
            .map((entry) => (typeof entry === 'string' ? normalizePreviewText(entry) : ''))
            .filter((entry): entry is string => Boolean(entry))
        : [];
      const contentText =
        (typeof rawThought.content === 'string' ? normalizePreviewText(rawThought.content) : '') ||
        chunks.join('\n\n');

      if (!contentText) {
        continue;
      }

      steps.push({
        summary: normalizeOptionalText(rawThought.summary),
        content: contentText,
        chunks,
      });
    }

    return steps;
  }

  function compareHistoryMessages(
    left: { createdAt: string | null; updatedAt: string | null; messageId: string | null },
    right: { createdAt: string | null; updatedAt: string | null; messageId: string | null },
  ): number {
    const leftTime = Date.parse(left.createdAt ?? left.updatedAt ?? '') || 0;
    const rightTime = Date.parse(right.createdAt ?? right.updatedAt ?? '') || 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return (left.messageId ?? '').localeCompare(right.messageId ?? '');
  }

  function buildHistorySearchText(
    messages: Array<{
      role: ChatHistoryMessageRole;
      text: string;
      reasoning?: {
        recap: string;
        steps: ChatHistoryReasoningStep[];
      } | null;
    }>,
  ): string {
    return messages
      .map((message) =>
        [
          message.role,
          message.text,
          message.reasoning?.recap ?? '',
          ...(message.reasoning?.steps.flatMap((step) => [step.summary ?? '', step.content, ...step.chunks]) ?? []),
        ]
          .filter(Boolean)
          .join(' '),
      )
      .join('\n')
      .toLowerCase();
  }

  function stringifyDebugValue(value: unknown): string {
    if (typeof value === 'string') {
      return cleanupText(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  function postDebug(level: DebugLevel, message: string, details: string | null = null): void {
    window.postMessage(
      {
        source: PAGE_DEBUG_MESSAGE_SOURCE,
        payload: {
          level,
          message,
          details,
          timestamp: new Date().toISOString(),
        },
      },
      '*',
    );
  }

  function logDebug(level: DebugLevel, ...values: unknown[]): void {
    const message = values.map((value) => stringifyDebugValue(value)).join(' ');
    postDebug(level, message);

    const logger = level === 'warn' ? originalConsole.warn : level === 'error' ? originalConsole.error : originalConsole.info;
    logger('[desktop-poc]', ...values);
  }

  function emitConversationHistory(payload: {
    projectId: string;
    projectName: string | null;
    chatId: string;
    chatName: string | null;
    messageCount: number;
    messages: ExtractedChatHistoryMessage[];
    searchText: string;
    updatedAt: string | null;
    capturedAt: string;
    isPartial?: boolean;
  }): void {
    window.postMessage(
      {
        source: PAGE_HISTORY_MESSAGE_SOURCE,
        payload,
      },
      '*',
    );
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function parseSameOriginUrl(value: string | null | undefined): URL | null {
    const href = cleanupText(value);
    if (!href) {
      return null;
    }

    try {
      return new URL(href, window.location.origin);
    } catch {
      return null;
    }
  }

  function serializeUrl(url: URL): string {
    const normalized = new URL(url.href);
    normalized.hash = '';
    return normalized.toString();
  }

  function detectConversationIdFromUrl(url: URL): string | null {
    const segments = url.pathname.split('/').filter(Boolean);
    const conversationIndex = segments.lastIndexOf('c');

    if (conversationIndex < 0 || !segments[conversationIndex + 1]) {
      return null;
    }

    return cleanupText(segments[conversationIndex + 1]) || null;
  }

  function extractProjectContextFromUrl(url: URL): { externalId: string | null } {
    const explicit =
      url.searchParams.get('project') ??
      url.searchParams.get('projectId') ??
      url.searchParams.get('project_id');
    if (explicit) {
      return {
        externalId: cleanupText(explicit) || null,
      };
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const groupedProjectSegment = (() => {
      const groupedIndex = segments.findIndex((segment) => segment === 'g');
      if (groupedIndex >= 0 && segments[groupedIndex + 1]?.startsWith('g-p-')) {
        return segments[groupedIndex + 1];
      }

      return segments.find((segment) => segment.startsWith('g-p-')) ?? null;
    })();

    if (groupedProjectSegment) {
      const groupedMatch = /^(g-p-[0-9a-f]+)(?:-(.+))?$/i.exec(groupedProjectSegment);
      if (groupedMatch) {
        return {
          externalId: cleanupText(groupedMatch[1]) || null,
        };
      }

      return {
        externalId: cleanupText(groupedProjectSegment) || null,
      };
    }

    const projectIndex = segments.findIndex((segment) => segment === 'project' || segment === 'projects');
    if (projectIndex >= 0 && segments[projectIndex + 1]) {
      return {
        externalId: cleanupText(segments[projectIndex + 1]) || null,
      };
    }

    return {
      externalId: null,
    };
  }

  function deriveProjectUrl(url: URL, projectId: string | null, conversationId: string | null): string | null {
    if (!projectId) {
      return null;
    }

    const normalized = new URL(url.href);
    normalized.hash = '';

    if (!conversationId) {
      return normalized.toString();
    }

    const segments = normalized.pathname.split('/').filter(Boolean);
    const conversationIndex = segments.lastIndexOf('c');
    if (conversationIndex >= 0 && segments[conversationIndex + 1]) {
      segments.splice(conversationIndex, 2);
      normalized.pathname = segments.length ? `/${segments.join('/')}` : '/';
    }

    return normalized.toString();
  }

  function isPersistableChatName(value: string | null | undefined): boolean {
    const normalized = cleanupText(value).toLowerCase();
    return Boolean(
      normalized &&
        normalized !== 'new chat' &&
        normalized !== 'untitled chat' &&
        !normalized.startsWith('saved chat '),
    );
  }

  function normalizeProjectNameCandidate(value: unknown, projectId: string | null): string | null {
    const normalized = cleanupText(value);
    if (!normalized || normalized.length > 160) {
      return null;
    }

    const comparable = normalized.toLowerCase();
    const excludedValues = new Set(
      [projectId, 'chatgpt', 'project', 'projects']
        .map((entry) => cleanupText(entry).toLowerCase())
        .filter(Boolean),
    );

    if (excludedValues.has(comparable)) {
      return null;
    }

    return normalized;
  }

  function resolveSnapshotConversationId(rawUrl: string): string | null {
    try {
      const parsedUrl = new URL(String(rawUrl), window.location.href);
      const match = parsedUrl.pathname.match(SNAPSHOT_URL_PATTERN);
      return match ? cleanupText(match[1]) || null : null;
    } catch {
      return null;
    }
  }

  function resolveProjectConversationsProjectId(rawUrl: string): string | null {
    try {
      const parsedUrl = new URL(String(rawUrl), window.location.href);
      const match = parsedUrl.pathname.match(PROJECT_CONVERSATIONS_URL_PATTERN);
      return match ? cleanupText(match[1]) || null : null;
    } catch {
      return null;
    }
  }

  function isLiveConversationUrl(rawUrl: string): boolean {
    try {
      const parsedUrl = new URL(String(rawUrl), window.location.href);
      return LIVE_STREAM_URL_PATTERN.test(parsedUrl.pathname);
    } catch {
      return false;
    }
  }

  function resolveConversationIdFromRequestBody(rawBody: string | null | undefined): string | null {
    if (!rawBody) {
      return null;
    }

    const parsed = parseJson(rawBody);
    if (!isRecord(parsed)) {
      return null;
    }

    return typeof parsed.conversation_id === 'string' ? cleanupText(parsed.conversation_id) || null : null;
  }

  function resolveConversationIdFromStreamValue(value: unknown, depth = 0): string | null {
    if (depth > 6 || value == null) {
      return null;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const nested = resolveConversationIdFromStreamValue(entry, depth + 1);
        if (nested) {
          return nested;
        }
      }

      return null;
    }

    if (!isRecord(value)) {
      return null;
    }

    if (typeof value.conversation_id === 'string') {
      return cleanupText(value.conversation_id) || null;
    }

    for (const nestedValue of Object.values(value)) {
      const nested = resolveConversationIdFromStreamValue(nestedValue, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  function resolveConversationIdFromDataText(dataText: string): string | null {
    const match = STREAM_CONVERSATION_ID_PATTERN.exec(dataText);
    return match ? cleanupText(match[1]) || null : null;
  }

  function cloneResponseSafely(response: Response): Response | null {
    if (!response || typeof response.clone !== 'function') {
      return null;
    }

    try {
      return response.clone();
    } catch {
      return null;
    }
  }

  function getHeaderEntries(headersLike: unknown): HeaderEntries {
    if (!headersLike) {
      return [];
    }

    try {
      if (headersLike instanceof Headers) {
        const entries: HeaderEntries = [];
        headersLike.forEach((value, name) => {
          entries.push([name, value]);
        });
        return entries;
      }

      if (Array.isArray(headersLike)) {
        return headersLike
          .filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length >= 2)
          .map((entry) => [String(entry[0]), entry[1]]);
      }

      if (isRecord(headersLike)) {
        return Object.entries(headersLike);
      }
    } catch {
      return [];
    }

    return [];
  }

  function isChatGptBackendUrl(rawUrl: string): boolean {
    try {
      const parsedUrl = new URL(String(rawUrl), window.location.href);
      return parsedUrl.origin === window.location.origin && /^\/backend-api(?:[/?#]|$)/.test(parsedUrl.pathname);
    } catch {
      return false;
    }
  }

  function shouldCaptureBackendHeader(name: string): boolean {
    return (
      name === 'accept' ||
      name === 'authorization' ||
      name === 'cache-control' ||
      name === 'pragma' ||
      name.startsWith('oai-') ||
      (name.startsWith('x-openai-') && name !== 'x-openai-target-path' && name !== 'x-openai-target-route')
    );
  }

  function captureAuthorizationValue(value: unknown): void {
    const normalizedValue = cleanupText(value);
    if (!normalizedValue || normalizedValue.length > MAX_TRACKED_FIELD_LENGTH) {
      return;
    }

    authState.authorization = normalizedValue;
  }

  function captureBackendHeaderValue(name: unknown, value: unknown): void {
    const normalizedName = cleanupText(name).toLowerCase();
    const normalizedValue = cleanupText(value);
    if (!normalizedName || !normalizedValue || normalizedValue.length > MAX_TRACKED_FIELD_LENGTH) {
      return;
    }

    if (!shouldCaptureBackendHeader(normalizedName)) {
      return;
    }

    if (normalizedName === 'authorization') {
      captureAuthorizationValue(normalizedValue);
      return;
    }

    capturedBackendHeaders[normalizedName] = normalizedValue;
  }

  function captureBackendHeadersFromRequest(rawUrl: string, headersLike: unknown): void {
    if (!isChatGptBackendUrl(rawUrl)) {
      return;
    }

    for (const [name, value] of getHeaderEntries(headersLike)) {
      captureBackendHeaderValue(name, value);
    }
  }

  function captureBootstrapAuthorization(): void {
    const bootstrapToken = cleanupText(
      (window as Window & { __NEXT_DATA__?: { props?: { pageProps?: { clientBootstrap?: { session?: { accessToken?: string } } } } } }).__NEXT_DATA__?.props?.pageProps?.clientBootstrap?.session?.accessToken,
    );
    if (bootstrapToken) {
      captureAuthorizationValue(`Bearer ${bootstrapToken}`);
    }
  }

  function readCookieValue(name: string): string {
    try {
      const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
      return cookieMatch ? cleanupText(decodeURIComponent(cookieMatch[1])) : '';
    } catch {
      return '';
    }
  }

  function captureBootstrapBackendHeaders(): void {
    const rootElement = document.documentElement;
    const buildNumber = cleanupText(rootElement?.dataset?.seq);
    const clientVersion = cleanupText(rootElement?.dataset?.build);
    const deviceId = readCookieValue('oai-did');
    const language = cleanupText(rootElement?.lang) || cleanupText(navigator.language);

    if (buildNumber) {
      capturedBackendHeaders['oai-client-build-number'] = buildNumber;
    }
    if (clientVersion) {
      capturedBackendHeaders['oai-client-version'] = clientVersion;
    }
    if (deviceId) {
      capturedBackendHeaders['oai-device-id'] = deviceId;
    }
    if (language) {
      capturedBackendHeaders['oai-language'] = language;
    }
  }

  function resolveBackendTargetRoute(pathname: string): string | null {
    if (/^\/backend-api\/conversation\/[^/?#]+\/interpreter\/download\/?$/.test(pathname)) {
      return '/backend-api/conversation/{conversation_id}/interpreter/download';
    }

    return null;
  }

  function buildBackendRequestHeaders(rawUrl: string, headersLike?: HeadersInit): Headers {
    captureBootstrapAuthorization();
    captureBootstrapBackendHeaders();

    const headers = new Headers(headersLike || undefined);
    for (const [name, value] of Object.entries(capturedBackendHeaders)) {
      if (!headers.has(name)) {
        headers.set(name, value);
      }
    }

    if (authState.authorization && !headers.has('authorization')) {
      headers.set('authorization', authState.authorization);
    }

    try {
      const parsedUrl = new URL(String(rawUrl), window.location.href);
      const targetRoute = resolveBackendTargetRoute(parsedUrl.pathname);
      if (targetRoute && !headers.has('x-openai-target-route')) {
        headers.set('x-openai-target-route', targetRoute);
      }
      if (targetRoute && !headers.has('x-openai-target-path')) {
        headers.set('x-openai-target-path', parsedUrl.pathname);
      }
    } catch {
      // ignore
    }

    if (isChatGptBackendUrl(rawUrl)) {
      if (!headers.has('accept')) {
        headers.set('accept', '*/*');
      }
      if (!headers.has('cache-control')) {
        headers.set('cache-control', 'no-cache');
      }
      if (!headers.has('pragma')) {
        headers.set('pragma', 'no-cache');
      }
    }

    return headers;
  }

  function postAppRequest(action: string, payload: unknown): Promise<unknown> {
    const requestId = `app-bridge-${Date.now()}-${++appBridgeSequence}`;
    return new Promise((resolve, reject) => {
      pendingAppBridgeRequests.set(requestId, { resolve, reject });
      window.postMessage(
        {
          source: PAGE_APP_REQUEST_MESSAGE_SOURCE,
          requestId,
          action,
          payload,
        },
        '*',
      );
    });
  }

  function handleAppResponseMessage(payload: unknown): void {
    if (!isRecord(payload)) {
      return;
    }

    const requestId = typeof payload.requestId === 'string' ? cleanupText(payload.requestId) : '';
    if (!requestId) {
      return;
    }

    const pending = pendingAppBridgeRequests.get(requestId);
    if (!pending) {
      return;
    }

    pendingAppBridgeRequests.delete(requestId);
    if (payload.ok === false) {
      pending.reject(typeof payload.error === 'string' ? payload.error : 'Unknown bridge error.');
      return;
    }

    pending.resolve(payload.payload);
  }

  function rememberSandboxFileRecord(record: {
    projectId: string;
    projectName: string | null;
    chatId: string;
    messageId: string;
    sandboxPath: string;
    downloadPath: string | null;
    discoveredAt: string;
    updatedAt: string;
  }): void {
    const fileKey = getSandboxFileKey(record.chatId, record.messageId, record.sandboxPath);
    knownSandboxFilesByKey.set(fileKey, record);
    knownSandboxFilesByChatPath.set(getSandboxChatPathKey(record.chatId, record.sandboxPath), record);
  }

  function registerSandboxFilesFromText(params: {
    projectId: string | null;
    projectName: string | null;
    chatId: string;
    messageId: string | null;
    text: string | null;
    detectedAt: string;
  }): void {
    if (!params.projectId || !params.chatId || !params.messageId || !params.text) {
      return;
    }

    const sandboxPaths = extractSandboxPaths(params.text);
    if (sandboxPaths.length) {
      logDebug(
        'info',
        `Detected sandbox files in last final assistant message: chatId="${params.chatId}" messageId="${params.messageId}" count="${String(sandboxPaths.length)}"`,
        sandboxPaths.join('\n'),
      );
    }

    const freshRecords: Array<{
      projectId: string;
      projectName: string | null;
      chatId: string;
      messageId: string;
      sandboxPath: string;
      downloadPath: string | null;
      discoveredAt: string;
      updatedAt: string;
    }> = [];

    for (const sandboxPath of sandboxPaths) {
      const fileKey = getSandboxFileKey(params.chatId, params.messageId, sandboxPath);
      const existingRecord = knownSandboxFilesByKey.get(fileKey) ?? null;
      const record = {
        projectId: params.projectId,
        projectName: params.projectName,
        chatId: params.chatId,
        messageId: params.messageId,
        sandboxPath,
        downloadPath: existingRecord?.downloadPath ?? null,
        discoveredAt: existingRecord?.discoveredAt ?? params.detectedAt,
        updatedAt: params.detectedAt,
      };
      rememberSandboxFileRecord(record);
      if (!existingRecord) {
        freshRecords.push(record);
      }
    }

    if (!freshRecords.length) {
      return;
    }

    void postAppRequest('register-sandbox-files', freshRecords)
      .then((response) => {
        if (!Array.isArray(response)) {
          return;
        }

        for (const item of response) {
          const resultRecord = isRecord(item) && isRecord(item.record) ? item.record : null;
          if (!resultRecord) {
            continue;
          }

          rememberSandboxFileRecord({
            projectId: typeof resultRecord.projectId === 'string' ? cleanupText(resultRecord.projectId) : params.projectId!,
            projectName: typeof resultRecord.projectName === 'string' ? cleanupText(resultRecord.projectName) : params.projectName,
            chatId: typeof resultRecord.chatId === 'string' ? cleanupText(resultRecord.chatId) : params.chatId,
            messageId: typeof resultRecord.messageId === 'string' ? cleanupText(resultRecord.messageId) : params.messageId!,
            sandboxPath: typeof resultRecord.sandboxPath === 'string' ? cleanupText(resultRecord.sandboxPath) : '',
            downloadPath: typeof resultRecord.downloadPath === 'string' ? cleanupText(resultRecord.downloadPath) : null,
            discoveredAt: typeof resultRecord.discoveredAt === 'string' ? cleanupText(resultRecord.discoveredAt) : params.detectedAt,
            updatedAt: typeof resultRecord.updatedAt === 'string' ? cleanupText(resultRecord.updatedAt) : params.detectedAt,
          });
        }
      })
      .catch((error) => {
        logDebug('warn', 'Sandbox file registration failed.', String(error));
      });
  }

  function isAssistantFinalMessageCandidate(message: {
    role: ChatHistoryMessageRole;
    contentType?: string | null;
    text: string;
  }): boolean {
    if (message.role !== 'assistant') {
      return false;
    }

    const contentType = normalizeOptionalText(message.contentType);
    if (!contentType || contentType === 'text') {
      return Boolean(cleanupText(message.text));
    }

    return false;
  }

  function registerSandboxFilesFromFinalAssistantMessages(params: {
    projectId: string | null;
    projectName: string | null;
    chatId: string;
    messages: Array<{
      messageId: string | null;
      role: ChatHistoryMessageRole;
      text: string;
      contentType?: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  }): void {
    if (!params.projectId || !params.chatId || !params.messages.length) {
      return;
    }

    for (let index = params.messages.length - 1; index >= 0; index -= 1) {
      const candidate = params.messages[index];
      if (!isAssistantFinalMessageCandidate(candidate) || !candidate.messageId) {
        continue;
      }

      registerSandboxFilesFromText({
        projectId: params.projectId,
        projectName: params.projectName,
        chatId: params.chatId,
        messageId: candidate.messageId,
        text: candidate.text,
        detectedAt: candidate.updatedAt ?? candidate.createdAt ?? new Date().toISOString(),
      });
      return;
    }
  }

  function postSandboxFileStatus(payload: {
    projectId: string;
    chatId: string;
    messageId: string;
    sandboxPath: string;
    fileName: string | null;
    status: 'waiting' | 'resolving' | 'downloading' | 'saving' | 'downloaded' | 'cancelled' | 'error';
    progressPercent?: number | null;
    message?: string | null;
    downloadPath?: string | null;
    updatedAt?: string;
  }): void {
    window.postMessage(
      {
        source: PAGE_FILE_STATUS_MESSAGE_SOURCE,
        payload: {
          ...payload,
          updatedAt: payload.updatedAt ?? new Date().toISOString(),
        },
      },
      '*',
    );
  }

  function getQueuedSandboxFileRecord(fileKey: string): {
    projectId: string;
    projectName: string | null;
    chatId: string;
    messageId: string;
    sandboxPath: string;
    downloadPath: string | null;
    discoveredAt: string;
    updatedAt: string;
  } | null {
    return knownSandboxFilesByKey.get(fileKey) ?? null;
  }

  function getSandboxDownloadDelayMs(): number {
    return 10000 + Math.floor(Math.random() * 10001);
  }

  function markSandboxDownloadStatus(
    record: {
      projectId: string;
      projectName: string | null;
      chatId: string;
      messageId: string;
      sandboxPath: string;
      downloadPath: string | null;
      discoveredAt: string;
      updatedAt: string;
    },
    status: 'waiting' | 'resolving' | 'downloading' | 'saving' | 'downloaded' | 'cancelled' | 'error',
    options: { progressPercent?: number | null; message?: string | null; downloadPath?: string | null } = {},
  ): void {
    const fileKey = getSandboxFileKey(record.chatId, record.messageId, record.sandboxPath);
    const nextUpdatedAt = new Date().toISOString();
    sandboxDownloadStatuses.set(fileKey, {
      status,
      progressPercent: typeof options.progressPercent === 'number' && Number.isFinite(options.progressPercent) ? options.progressPercent : null,
      message: options.message ?? null,
      updatedAt: nextUpdatedAt,
    });
    postSandboxFileStatus({
      projectId: record.projectId,
      chatId: record.chatId,
      messageId: record.messageId,
      sandboxPath: record.sandboxPath,
      fileName: getSandboxFileName(record.sandboxPath),
      status,
      progressPercent: typeof options.progressPercent === 'number' && Number.isFinite(options.progressPercent) ? options.progressPercent : null,
      message: options.message ?? null,
      downloadPath: options.downloadPath ?? record.downloadPath ?? null,
      updatedAt: nextUpdatedAt,
    });
  }

  function updateWaitingSandboxStatuses(): void {
    for (const fileKey of sandboxDownloadQueue) {
      const record = getQueuedSandboxFileRecord(fileKey);
      if (!record) {
        continue;
      }
      markSandboxDownloadStatus(record, 'waiting', { message: 'Waiting in queue', progressPercent: 0 });
    }
  }

  async function processSandboxDownloadQueue(): Promise<void> {
    if (currentSandboxDownloadKey || nextSandboxDownloadTimer !== null) {
      return;
    }

    const nextFileKey = sandboxDownloadQueue.shift();
    if (!nextFileKey) {
      return;
    }

    const record = getQueuedSandboxFileRecord(nextFileKey);
    if (!record) {
      void processSandboxDownloadQueue();
      return;
    }

    if (record.downloadPath) {
      markSandboxDownloadStatus(record, 'downloaded', { progressPercent: 100, message: 'Already downloaded', downloadPath: record.downloadPath });
      void processSandboxDownloadQueue();
      return;
    }

    currentSandboxDownloadKey = nextFileKey;
    currentSandboxDownloadAbortController = new AbortController();

    try {
      updateDownloadPopup({
        title: 'Resolving file link',
        file: record.sandboxPath,
        percent: 0,
        status: 'Requesting an authenticated download URL…',
      });
      markSandboxDownloadStatus(record, 'resolving', { message: 'Resolving link', progressPercent: 0 });
      const downloadUrl = await resolveSandboxDownload(record, currentSandboxDownloadAbortController.signal);
      updateDownloadPopup({
        title: 'Downloading file',
        file: record.sandboxPath,
        percent: 0,
        status: 'Streaming the authenticated file payload…',
      });
      const bytes = await fetchSandboxDownload(downloadUrl, currentSandboxDownloadAbortController.signal, (receivedBytes, totalBytes) => {
        const percent = totalBytes && totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : receivedBytes > 0 ? 100 : 0;
        markSandboxDownloadStatus(record, 'downloading', { message: 'Downloading', progressPercent: percent });
        updateDownloadPopup({
          title: 'Downloading file',
          file: record.sandboxPath,
          percent,
          status: totalBytes && totalBytes > 0 ? `${Math.round(receivedBytes / 1024)} KB / ${Math.round(totalBytes / 1024)} KB` : `${Math.round(receivedBytes / 1024)} KB received`,
        });
      });
      markSandboxDownloadStatus(record, 'saving', { message: 'Saving file' });
      updateDownloadPopup({
        title: 'Saving file',
        file: record.sandboxPath,
        percent: 100,
        status: 'Passing the downloaded file into the desktop app…',
      });
      const savedRecord = await postAppRequest('save-downloaded-file', {
        projectId: record.projectId,
        projectName: record.projectName,
        chatId: record.chatId,
        messageId: record.messageId,
        sandboxPath: record.sandboxPath,
        downloadUrl,
        downloadPath: record.downloadPath,
        fileName: getSandboxFileName(record.sandboxPath),
        discoveredAt: record.discoveredAt,
        updatedAt: new Date().toISOString(),
        bytes,
      });

      if (isRecord(savedRecord)) {
        rememberSandboxFileRecord({
          projectId: typeof savedRecord.projectId === 'string' ? cleanupText(savedRecord.projectId) : record.projectId,
          projectName: typeof savedRecord.projectName === 'string' ? cleanupText(savedRecord.projectName) : record.projectName,
          chatId: typeof savedRecord.chatId === 'string' ? cleanupText(savedRecord.chatId) : record.chatId,
          messageId: typeof savedRecord.messageId === 'string' ? cleanupText(savedRecord.messageId) : record.messageId,
          sandboxPath: typeof savedRecord.sandboxPath === 'string' ? cleanupText(savedRecord.sandboxPath) : record.sandboxPath,
          downloadPath: typeof savedRecord.downloadPath === 'string' ? cleanupText(savedRecord.downloadPath) : null,
          discoveredAt: typeof savedRecord.discoveredAt === 'string' ? cleanupText(savedRecord.discoveredAt) : record.discoveredAt,
          updatedAt: typeof savedRecord.updatedAt === 'string' ? cleanupText(savedRecord.updatedAt) : new Date().toISOString(),
        });
      }

      const finalRecord = getQueuedSandboxFileRecord(nextFileKey) ?? record;
      markSandboxDownloadStatus(finalRecord, 'downloaded', {
        progressPercent: 100,
        message: 'Downloaded',
        downloadPath: finalRecord.downloadPath ?? null,
      });
      updateDownloadPopup({
        title: 'Download complete',
        file: record.sandboxPath,
        percent: 100,
        status: 'The file was saved into the current project’s .chatgpt folder.',
      });
      hideDownloadPopup(1800);
    } catch (error) {
      const isAbort = error instanceof DOMException ? error.name === 'AbortError' : String(error).includes('AbortError');
      if (isAbort) {
        markSandboxDownloadStatus(record, 'cancelled', { message: 'Cancelled' });
        updateDownloadPopup({
          title: 'Download cancelled',
          file: record.sandboxPath,
          percent: 0,
          status: 'The queued download was cancelled.',
          error: true,
        });
        hideDownloadPopup(1200);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        markSandboxDownloadStatus(record, 'error', { message });
        updateDownloadPopup({
          title: 'Download failed',
          file: record.sandboxPath,
          percent: 0,
          status: message,
          error: true,
        });
        hideDownloadPopup(2400);
        logDebug('error', 'Sandbox file download failed.', message);
      }
    } finally {
      currentSandboxDownloadKey = null;
      currentSandboxDownloadAbortController = null;
      updateWaitingSandboxStatuses();
      if (sandboxDownloadQueue.length) {
        const delayMs = getSandboxDownloadDelayMs();
        nextSandboxDownloadTimer = window.setTimeout(() => {
          nextSandboxDownloadTimer = null;
          void processSandboxDownloadQueue();
        }, delayMs);
      }
    }
  }

  function enqueueSandboxFileDownload(rawPayload: unknown): void {
    const source = isRecord(rawPayload) && isRecord(rawPayload.file) ? rawPayload.file : rawPayload;
    if (!isRecord(source)) {
      return;
    }

    const chatId = typeof source.chatId === 'string' ? cleanupText(source.chatId) : '';
    const messageId = typeof source.messageId === 'string' ? cleanupText(source.messageId) : '';
    const sandboxPath = typeof source.sandboxPath === 'string' ? cleanupText(source.sandboxPath) : '';
    const projectId = typeof source.projectId === 'string' ? cleanupText(source.projectId) : '';
    if (!projectId || !chatId || !messageId || !sandboxPath) {
      return;
    }

    const fileKey = getSandboxFileKey(chatId, messageId, sandboxPath);
    if (!knownSandboxFilesByKey.has(fileKey)) {
      rememberSandboxFileRecord({
        projectId,
        projectName: typeof source.projectName === 'string' ? cleanupText(source.projectName) : null,
        chatId,
        messageId,
        sandboxPath,
        downloadPath: typeof source.downloadPath === 'string' ? cleanupText(source.downloadPath) : null,
        discoveredAt: typeof source.discoveredAt === 'string' ? cleanupText(source.discoveredAt) : new Date().toISOString(),
        updatedAt: typeof source.updatedAt === 'string' ? cleanupText(source.updatedAt) : new Date().toISOString(),
      });
    }

    const record = getQueuedSandboxFileRecord(fileKey);
    if (!record) {
      return;
    }

    if (record.downloadPath) {
      markSandboxDownloadStatus(record, 'downloaded', { progressPercent: 100, message: 'Already downloaded', downloadPath: record.downloadPath });
      return;
    }

    if (currentSandboxDownloadKey === fileKey || sandboxDownloadQueue.includes(fileKey)) {
      return;
    }

    sandboxDownloadQueue.push(fileKey);
    updateWaitingSandboxStatuses();
    if (!currentSandboxDownloadKey && nextSandboxDownloadTimer === null) {
      void processSandboxDownloadQueue();
    }
  }

  function cancelSandboxFileDownload(rawPayload: unknown): void {
    const source = isRecord(rawPayload) && isRecord(rawPayload.file) ? rawPayload.file : rawPayload;
    if (!isRecord(source)) {
      return;
    }

    const chatId = typeof source.chatId === 'string' ? cleanupText(source.chatId) : '';
    const messageId = typeof source.messageId === 'string' ? cleanupText(source.messageId) : '';
    const sandboxPath = typeof source.sandboxPath === 'string' ? cleanupText(source.sandboxPath) : '';
    if (!chatId || !messageId || !sandboxPath) {
      return;
    }

    const fileKey = getSandboxFileKey(chatId, messageId, sandboxPath);
    const record = getQueuedSandboxFileRecord(fileKey);
    if (!record) {
      return;
    }

    const queueIndex = sandboxDownloadQueue.indexOf(fileKey);
    if (queueIndex >= 0) {
      sandboxDownloadQueue.splice(queueIndex, 1);
      markSandboxDownloadStatus(record, 'cancelled', { message: 'Cancelled' });
      return;
    }

    if (currentSandboxDownloadKey === fileKey && currentSandboxDownloadAbortController) {
      currentSandboxDownloadAbortController.abort();
    }
  }

  function handleAppCommandMessage(payload: unknown): void {
    if (!isRecord(payload)) {
      return;
    }

    const command = typeof payload.command === 'string' ? cleanupText(payload.command) : typeof payload.action === 'string' ? cleanupText(payload.action) : '';
    if (command === 'enqueue-file-download') {
      enqueueSandboxFileDownload(payload);
      return;
    }

    if (command === 'cancel-file-download') {
      cancelSandboxFileDownload(payload);
    }
  }

  function findKnownSandboxFile(chatId: string, sandboxPath: string): {
    projectId: string;
    projectName: string | null;
    chatId: string;
    messageId: string;
    sandboxPath: string;
    downloadPath: string | null;
    discoveredAt: string;
    updatedAt: string;
  } | null {
    return knownSandboxFilesByChatPath.get(getSandboxChatPathKey(chatId, sandboxPath)) ?? null;
  }

  let downloadPopupElement: HTMLDivElement | null = null;

  function ensureDownloadPopup(): HTMLDivElement {
    if (downloadPopupElement && document.body.contains(downloadPopupElement)) {
      return downloadPopupElement;
    }

    const element = document.createElement('div');
    element.style.position = 'fixed';
    element.style.right = '24px';
    element.style.bottom = '24px';
    element.style.width = '320px';
    element.style.padding = '16px';
    element.style.borderRadius = '14px';
    element.style.background = 'rgba(21, 24, 32, 0.96)';
    element.style.color = '#f5f7fb';
    element.style.boxShadow = '0 18px 48px rgba(0, 0, 0, 0.36)';
    element.style.backdropFilter = 'blur(10px)';
    element.style.fontFamily = 'Inter, system-ui, sans-serif';
    element.style.zIndex = '2147483647';
    element.style.display = 'none';
    element.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;">
        <strong data-role="title" style="font-size:14px;">Downloading file</strong>
        <span data-role="percent" style="font-size:12px;color:rgba(255,255,255,0.72);">0%</span>
      </div>
      <div data-role="file" style="font-size:12px;line-height:1.4;color:rgba(255,255,255,0.86);word-break:break-all;margin-bottom:10px;"></div>
      <div style="height:8px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;">
        <div data-role="bar" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#5ba7ff 0%,#7ef0c4 100%);"></div>
      </div>
      <div data-role="status" style="margin-top:10px;font-size:12px;color:rgba(255,255,255,0.72);"></div>
    `;
    document.body.append(element);
    downloadPopupElement = element;
    return element;
  }

  function updateDownloadPopup(status: { title?: string; file?: string; percent?: number; status?: string; error?: boolean }): void {
    const popup = ensureDownloadPopup();
    popup.style.display = 'block';
    const title = popup.querySelector('[data-role="title"]');
    const file = popup.querySelector('[data-role="file"]');
    const percent = popup.querySelector('[data-role="percent"]');
    const bar = popup.querySelector('[data-role="bar"]') as HTMLDivElement | null;
    const statusNode = popup.querySelector('[data-role="status"]') as HTMLDivElement | null;
    if (title && status.title) {
      title.textContent = status.title;
    }
    if (file && status.file) {
      file.textContent = status.file;
    }
    const percentValue = Number.isFinite(status.percent) ? Math.max(0, Math.min(100, Math.round(status.percent ?? 0))) : 0;
    if (percent) {
      percent.textContent = `${String(percentValue)}%`;
    }
    if (bar) {
      bar.style.width = `${String(percentValue)}%`;
      bar.style.background = status.error ? 'linear-gradient(90deg,#ff7b7b 0%,#ffb27a 100%)' : 'linear-gradient(90deg,#5ba7ff 0%,#7ef0c4 100%)';
    }
    if (statusNode) {
      statusNode.textContent = status.status ?? '';
      statusNode.style.color = status.error ? '#ffb3b3' : 'rgba(255,255,255,0.72)';
    }
  }

  function hideDownloadPopup(delayMs = 1200): void {
    window.setTimeout(() => {
      if (downloadPopupElement) {
        downloadPopupElement.style.display = 'none';
      }
    }, delayMs);
  }

  async function resolveSandboxDownload(candidate: {
    chatId: string;
    messageId: string;
    sandboxPath: string;
  }, signal?: AbortSignal): Promise<string> {
    const resolveUrl = new URL(`/backend-api/conversation/${encodeURIComponent(candidate.chatId)}/interpreter/download`, window.location.origin);
    resolveUrl.searchParams.set('message_id', candidate.messageId);
    resolveUrl.searchParams.set('sandbox_path', candidate.sandboxPath);
    logDebug(
      'info',
      `Intercepted sandbox download resolution request: chatId="${candidate.chatId}" messageId="${candidate.messageId}" sandboxPath="${candidate.sandboxPath}" url="${resolveUrl.href}"`,
    );
    const response = await originalFetch(resolveUrl.href, {
      credentials: 'include',
      headers: buildBackendRequestHeaders(resolveUrl.href),
      signal,
    });
    logDebug(
      'info',
      `Sandbox download resolution response: status="${String(response.status)}" chatId="${candidate.chatId}" messageId="${candidate.messageId}" sandboxPath="${candidate.sandboxPath}"`,
    );
    if (!response.ok) {
      throw new Error(`Download resolution failed with status ${response.status}.`);
    }

    const payloadText = await response.text();
    const payloadJson = parseJson(payloadText);
    if (!isRecord(payloadJson)) {
      throw new Error('Download resolution returned malformed JSON.');
    }

    const rawDownloadUrl = findStringInValue(payloadJson, ['download_url', 'downloadUrl', 'url']);
    if (!rawDownloadUrl) {
      throw new Error('download_url is missing in the resolution response.');
    }

    return new URL(rawDownloadUrl, window.location.origin).href;
  }

  async function fetchSandboxDownload(
    downloadUrl: string,
    signal: AbortSignal | undefined,
    onProgress: (receivedBytes: number, totalBytes: number | null) => void,
  ): Promise<Uint8Array> {
    const response = await originalFetch(downloadUrl, {
      credentials: 'include',
      headers: buildBackendRequestHeaders(downloadUrl),
      signal,
    });
    if (!response.ok) {
      throw new Error(`File download failed with status ${response.status}.`);
    }

    const totalBytesHeader = Number(response.headers.get('content-length'));
    const totalBytes = Number.isFinite(totalBytesHeader) && totalBytesHeader > 0 ? totalBytesHeader : null;
    const stream = response.body;
    if (!stream || typeof stream.getReader !== 'function') {
      const buffer = new Uint8Array(await response.arrayBuffer());
      onProgress(buffer.byteLength, buffer.byteLength);
      return buffer;
    }

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        chunks.push(value);
        receivedBytes += value.byteLength;
        onProgress(receivedBytes, totalBytes);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }

    const merged = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return merged;
  }

  function findStringInValue(value: unknown, keys: string[], depth = 0): string | null {
    if (depth > 6 || value == null) {
      return null;
    }

    if (typeof value === 'string') {
      const normalized = cleanupText(value);
      return normalized || null;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const nested = findStringInValue(entry, keys, depth + 1);
        if (nested) {
          return nested;
        }
      }
      return null;
    }

    if (!isRecord(value)) {
      return null;
    }

    for (const key of keys) {
      const directValue = value[key];
      if (typeof directValue === 'string') {
        const normalized = cleanupText(directValue);
        if (normalized) {
          return normalized;
        }
      }
    }

    for (const nestedValue of Object.values(value)) {
      const nested = findStringInValue(nestedValue, keys, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }


  function extractProjectIdFromHeaders(headersLike: unknown): string | null {
    for (const [name, value] of getHeaderEntries(headersLike)) {
      if (cleanupText(name).toLowerCase() !== 'chatgpt-project-id') {
        continue;
      }

      const projectId = cleanupText(value);
      if (projectId.startsWith('g-p-')) {
        return projectId;
      }
    }

    return null;
  }

  function captureConversationProjectHint(conversationId: string | null, headersLike: unknown): void {
    if (!conversationId) {
      return;
    }

    const projectId = extractProjectIdFromHeaders(headersLike);
    if (!projectId) {
      return;
    }

    pendingConversationProjectIds.set(conversationId, projectId);
    knownConversationProjectIds.set(conversationId, projectId);
  }

  function captureProjectIdHint(rawUrl: string, headersLike: unknown): void {
    const conversationId = resolveSnapshotConversationId(rawUrl);
    captureConversationProjectHint(conversationId, headersLike);
  }

  function extractProjectIdFromValue(value: unknown, depth = 0): string | null {
    if (depth > 6 || value == null) {
      return null;
    }

    if (typeof value === 'string') {
      const match = /\bg-p-[0-9a-f]+\b/i.exec(value);
      return match ? cleanupText(match[0]) || null : null;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const nested = extractProjectIdFromValue(entry, depth + 1);
        if (nested) {
          return nested;
        }
      }

      return null;
    }

    if (!isRecord(value)) {
      return null;
    }

    const directCandidates = [
      normalizeOptionalText(value.gizmo_id),
      normalizeOptionalText(value.conversation_template_id),
      normalizeOptionalText(value.project_id),
      normalizeOptionalText(value.projectId),
      normalizeOptionalText(value.id),
    ];

    for (const candidate of directCandidates) {
      if (candidate?.startsWith('g-p-')) {
        return candidate;
      }
    }

    for (const nestedValue of Object.values(value)) {
      const nested = extractProjectIdFromValue(nestedValue, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  function extractProjectNameFromMatchedRecord(record: Record<string, unknown>, projectId: string): string | null {
    const directCandidates = [
      normalizeProjectNameCandidate(record.project_name, projectId),
      normalizeProjectNameCandidate(record.projectName, projectId),
      normalizeProjectNameCandidate(record.gizmo_name, projectId),
      normalizeProjectNameCandidate(record.gizmoName, projectId),
      isRecord(record.display) ? normalizeProjectNameCandidate(record.display.name, projectId) : null,
      normalizeProjectNameCandidate(record.name, projectId),
    ].filter((candidate): candidate is string => Boolean(candidate));

    if (directCandidates[0]) {
      return directCandidates[0];
    }

    return null;
  }

  function extractProjectNameFromPayload(payload: unknown, projectId: string): string | null {
    if (!projectId || !isRecord(payload)) {
      return null;
    }

    const candidateRecords: Record<string, unknown>[] = [payload];

    if (isRecord(payload.project)) {
      candidateRecords.push(payload.project);
    }

    if (isRecord(payload.gizmo)) {
      candidateRecords.push(payload.gizmo);
    }

    if (isRecord(payload.metadata)) {
      candidateRecords.push(payload.metadata);
    }

    for (const record of candidateRecords) {
      const directIds = [
        normalizeOptionalText(record.id),
        normalizeOptionalText(record.gizmo_id),
        normalizeOptionalText(record.conversation_template_id),
        normalizeOptionalText(record.project_id),
        normalizeOptionalText(record.projectId),
      ];

      if (directIds.includes(projectId)) {
        const matchedName = extractProjectNameFromMatchedRecord(record, projectId);
        if (matchedName) {
          return matchedName;
        }
      }
    }

    return null;
  }

  function rememberChatName(conversationId: string, chatName: string | null, source: ChatNameSource): void {
    if (!conversationId || !chatName || !isPersistableChatName(chatName)) {
      return;
    }

    const existing = knownChatNames.get(conversationId) ?? null;
    const existingSource = knownChatNameSources.get(conversationId) ?? null;
    const nextName = cleanupText(chatName);
    const nextPriority = source === 'snapshot' ? 2 : 1;
    const existingPriority = existingSource === 'snapshot' ? 2 : existingSource === 'project-list' ? 1 : 0;

    if (existing && existingPriority > nextPriority) {
      return;
    }

    if (
      existing &&
      existingPriority === nextPriority &&
      DECORATED_CHAT_TITLE_PATTERN.test(nextName) &&
      !DECORATED_CHAT_TITLE_PATTERN.test(existing)
    ) {
      return;
    }

    knownChatNames.set(conversationId, nextName);
    knownChatNameSources.set(conversationId, source);
  }

  function rememberProjectName(projectId: string, projectName: string | null, source: ProjectNameSource): void {
    if (!projectId || !projectName) {
      return;
    }

    const normalizedName = normalizeProjectNameCandidate(projectName, projectId);
    if (!normalizedName) {
      return;
    }

    const existingSource = knownProjectNameSources.get(projectId) ?? null;
    const nextPriority = source === 'request-title' ? 3 : 2;
    const existingPriority = existingSource === 'request-title' ? 3 : existingSource === 'response' ? 2 : 0;

    if (existingPriority > nextPriority) {
      return;
    }

    knownProjectNames.set(projectId, normalizedName);
    knownProjectNameSources.set(projectId, source);
  }

  function parseProjectNameFromNetworkTitle(title: string, hasConversation: boolean): string | null {
    const normalizedTitle = cleanupText(title);
    if (!normalizedTitle) {
      return null;
    }

    const separatorMatch = /^(.+?)\s(?:-|\u2013|\u2014)\s(.+)$/.exec(normalizedTitle);
    if (!separatorMatch) {
      return null;
    }

    const left = cleanupText(separatorMatch[1]);
    const right = cleanupText(separatorMatch[2]);
    if (!left || !right) {
      return null;
    }

    if (hasConversation) {
      return /^chatgpt$/i.test(left) ? null : normalizeProjectNameCandidate(left, null);
    }

    if (/^chatgpt$/i.test(left)) {
      return normalizeProjectNameCandidate(right, null);
    }

    if (/^chatgpt$/i.test(right)) {
      return normalizeProjectNameCandidate(left, null);
    }

    return null;
  }

  function applyNetworkTitlePayload(payload: unknown, rawUrl: string): void {
    if (!isRecord(payload) || !isRecord(payload.context) || !isRecord(payload.context.page)) {
      return;
    }

    const pageContext = payload.context.page;
    const networkTitle = normalizeOptionalText(pageContext.title);
    const pageUrl = parseSameOriginUrl(normalizeOptionalText(pageContext.url) ?? normalizeOptionalText(pageContext.path));
    if (!networkTitle || !pageUrl) {
      return;
    }

    const conversationId = detectConversationIdFromUrl(pageUrl);
    const projectId =
      (isRecord(payload.properties) ? normalizeOptionalText(payload.properties.gizmo_id) : null) ??
      extractProjectContextFromUrl(pageUrl).externalId;

    if (!projectId) {
      return;
    }

    const projectName = parseProjectNameFromNetworkTitle(networkTitle, Boolean(conversationId));
    if (!projectName) {
      return;
    }

    if (conversationId) {
      knownConversationProjectIds.set(conversationId, projectId);
    }

    rememberProjectName(projectId, projectName, 'request-title');
    logDebug(
      'info',
      `Captured network page title: projectId="${projectId}" projectTitle="${projectName}" rawTitle="${networkTitle}" via="${rawUrl}"`,
    );
    scheduleEmit();
  }

  function parseJson(value: string | null | undefined): unknown | null {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  async function readRequestBody(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<string | null> {
    if (typeof init?.body === 'string') {
      return init.body;
    }

    if (input instanceof Request) {
      try {
        return await input.clone().text();
      } catch {
        return null;
      }
    }

    return typeof init?.body === 'undefined' ? null : String(init.body);
  }

  function captureTitlePayloadFromBody(rawUrl: string, bodyText: string | null | undefined): void {
    const payload = parseJson(bodyText);
    if (!payload) {
      return;
    }

    if (Array.isArray(payload)) {
      for (const entry of payload) {
        applyNetworkTitlePayload(entry, rawUrl);
      }
      return;
    }

    applyNetworkTitlePayload(payload, rawUrl);
  }

  function extractConversationHistoryRecord(
    conversationId: string,
    snapshot: unknown,
    projectId: string | null,
  ): {
    projectId: string;
    projectName: string | null;
    chatId: string;
    chatName: string | null;
    messageCount: number;
    messages: ExtractedChatHistoryMessage[];
    searchText: string;
    updatedAt: string | null;
    capturedAt: string;
  } | null {
    if (!projectId || !isRecord(snapshot) || !isRecord(snapshot.mapping)) {
      return null;
    }

    type SnapshotEntry = {
      messageId: string | null;
      nodeId: string;
      parentNodeId: string | null;
      parentMessageId: string | null;
      role: ChatHistoryMessageRole;
      authorName: string | null;
      modelSlug: string | null;
      text: string;
      createdAt: string | null;
      updatedAt: string | null;
      contentType: string | null;
      messageType: string | null;
      turnId: string | null;
      isHidden: boolean;
      endTurn: boolean | null;
      status: string | null;
      language: string | null;
      parts: ChatHistoryMultimodalPart[] | null;
      children: string[] | null;
      reasoningSteps: ChatHistoryReasoningStep[];
      reasoningMeta: { finishedDurationSec: number | null; startedAt: string | null; endedAt: string | null };
      metadataJson: string | null;
      rawJson: string | null;
    };

    const mapping = snapshot.mapping as Record<string, unknown>;
    const snapshotEntries = new Map<string, SnapshotEntry>();

    for (const [nodeId, rawEntry] of Object.entries(mapping)) {
      if (!isRecord(rawEntry) || !isRecord(rawEntry.message)) {
        continue;
      }

      const message = rawEntry.message;
      const content = isRecord(message.content) ? message.content : null;
      const metadata = isRecord(message.metadata) ? message.metadata : null;
      const contentType = normalizeOptionalText(content?.content_type);
      const messageType = metadata && typeof metadata.message_type === 'string'
        ? cleanupText(metadata.message_type) || null
        : null;
      const turnId = metadata && typeof metadata.turn_exchange_id === 'string'
        ? cleanupText(metadata.turn_exchange_id) || null
        : null;
      const isHidden = Boolean(metadata && metadata.is_visually_hidden_from_conversation === true);
      const endTurn = typeof message.end_turn === 'boolean' ? message.end_turn : null;
      const status = typeof message.status === 'string' ? cleanupText(message.status) || null : null;

      let text = '';
      let language: string | null = null;
      let parts: ChatHistoryMultimodalPart[] | null = null;

      if (contentType === 'code') {
        const code = extractCodeMessage(message);
        text = code.text;
        language = code.language;
      } else if (contentType === 'execution_output') {
        text = extractExecutionOutputText(message);
      } else if (contentType === 'multimodal_text') {
        const extracted = extractMessageText(message) ?? '';
        text = extracted;
        parts = extractMultimodalParts(message);
      } else {
        text = extractMessageText(message) ?? '';
      }

      const reasoningSteps = contentType === 'thoughts' ? extractReasoningSteps(message) : [];
      const reasoningMeta = contentType === 'reasoning_recap'
        ? extractReasoningMetadata(metadata)
        : { finishedDurationSec: null, startedAt: null, endedAt: null };

      const author = isRecord(message.author) ? message.author : null;
      const children = extractStringList(rawEntry.children);

      snapshotEntries.set(nodeId, {
        messageId: normalizeOptionalText(message.id),
        nodeId,
        parentNodeId: typeof rawEntry.parent === 'string' ? rawEntry.parent : null,
        parentMessageId: null,
        role: normalizeMessageRole(author ? author.role : null),
        authorName: normalizeOptionalText(author?.name),
        modelSlug: metadata ? normalizeOptionalText(metadata.model_slug) : null,
        text,
        createdAt: normalizeChatTimestampToIso(message.create_time),
        updatedAt: normalizeChatTimestampToIso(message.update_time),
        contentType,
        messageType,
        turnId,
        isHidden,
        endTurn,
        status,
        language,
        parts,
        children,
        reasoningSteps,
        reasoningMeta,
        metadataJson: extractPreservedMetadataJson(metadata),
        rawJson: safeStringifyJson(rawEntry),
      });
    }

    for (const entry of snapshotEntries.values()) {
      if (!entry.parentNodeId) {
        continue;
      }
      const parent = snapshotEntries.get(entry.parentNodeId);
      if (parent && parent.messageId) {
        entry.parentMessageId = parent.messageId;
      }
    }

    const findReasoningStepsForRecap = (entry: SnapshotEntry): ChatHistoryReasoningStep[] => {
      let currentNodeId = entry.parentNodeId;
      const visited = new Set<string>();

      while (currentNodeId && !visited.has(currentNodeId)) {
        visited.add(currentNodeId);
        const ancestor = snapshotEntries.get(currentNodeId);
        if (!ancestor) {
          break;
        }

        if (ancestor.contentType === 'thoughts' && ancestor.reasoningSteps.length) {
          return ancestor.reasoningSteps;
        }

        currentNodeId = ancestor.parentNodeId;
      }

      return [];
    };

    const buildSnapshotNodeOrder = (): string[] => {
      const currentNodeId = normalizeOptionalText(snapshot.current_node);
      const ordered: string[] = [];
      const seen = new Set<string>();

      if (currentNodeId && Object.prototype.hasOwnProperty.call(mapping, currentNodeId)) {
        const reversedPath: string[] = [];
        let cursor: string | null = currentNodeId;
        while (cursor && !seen.has(cursor)) {
          const rawEntry = isRecord(mapping[cursor]) ? mapping[cursor] : null;
          if (!rawEntry) {
            break;
          }
          seen.add(cursor);
          reversedPath.push(cursor);
          cursor = typeof rawEntry.parent === 'string' ? rawEntry.parent : null;
        }

        reversedPath.reverse();
        ordered.push(...reversedPath);
      }

      const appendDepthFirst = (nodeId: string): void => {
        if (seen.has(nodeId)) {
          return;
        }
        const rawEntry = isRecord(mapping[nodeId]) ? mapping[nodeId] : null;
        if (!rawEntry) {
          return;
        }

        seen.add(nodeId);
        ordered.push(nodeId);

        const children = extractStringList(rawEntry.children) ?? [];
        for (const childNodeId of children) {
          appendDepthFirst(childNodeId);
        }
      };

      for (const [nodeId, rawEntry] of Object.entries(mapping)) {
        if (!isRecord(rawEntry)) {
          continue;
        }

        if (!rawEntry.parent) {
          appendDepthFirst(nodeId);
        }
      }

      for (const nodeId of Object.keys(mapping)) {
        appendDepthFirst(nodeId);
      }

      return ordered;
    };

    const messages: ExtractedChatHistoryMessage[] = [];

    for (const nodeId of buildSnapshotNodeOrder()) {
      const entry = snapshotEntries.get(nodeId);
      if (!entry) {
        continue;
      }

      const reasoningSteps = entry.contentType === 'reasoning_recap'
        ? findReasoningStepsForRecap(entry)
        : entry.reasoningSteps;

      messages.push({
        messageId: entry.messageId,
        nodeId: entry.nodeId,
        parentMessageId: entry.parentMessageId,
        turnId: entry.turnId,
        role: entry.role,
        authorName: entry.authorName,
        modelSlug: entry.modelSlug,
        text: entry.text,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        contentType: entry.contentType,
        messageType: entry.messageType,
        language: entry.language,
        parts: entry.parts,
        children: entry.children,
        isHidden: entry.isHidden,
        endTurn: entry.endTurn,
        status: entry.status,
        reasoning:
          entry.contentType === 'reasoning_recap'
            ? {
                recap: entry.text,
                finishedDurationSec: entry.reasoningMeta.finishedDurationSec,
                startedAt: entry.reasoningMeta.startedAt,
                endedAt: entry.reasoningMeta.endedAt,
                steps: reasoningSteps,
                stepsLoaded: true,
              }
            : entry.contentType === 'thoughts' && reasoningSteps.length
              ? {
                  recap: entry.text || 'Thinking',
                  finishedDurationSec: null,
                  startedAt: null,
                  endedAt: null,
                  steps: reasoningSteps,
                  stepsLoaded: true,
                }
              : null,
        metadataJson: entry.metadataJson,
        rawJson: entry.rawJson,
      });
    }

    registerSandboxFilesFromFinalAssistantMessages({
      projectId,
      projectName: knownProjectNames.get(projectId) ?? null,
      chatId: conversationId,
      messages,
    });

    return {
      projectId,
      projectName: knownProjectNames.get(projectId) ?? null,
      chatId: conversationId,
      chatName: normalizeOptionalText(snapshot.title) ?? knownChatNames.get(conversationId) ?? null,
      messageCount: messages.length,
      messages,
      searchText: buildHistorySearchText(messages),
      updatedAt: normalizeChatTimestampToIso(snapshot.update_time),
      capturedAt: new Date().toISOString(),
    };
  }

  function createStreamContext(initialConversationId: string | null): StreamContext {
    return {
      anonymousMessageSequence: 0,
      conversationId: initialConversationId ?? detectConversationIdFromUrl(new URL(window.location.href, window.location.origin)),
      currentCreatedAt: null,
      currentMessageId: null,
      currentMessageKey: null,
      currentRole: 'unknown',
      currentUpdatedAt: null,
      emitTimer: null,
      messagesByKey: new Map(),
      messageFieldBuffers: new Map(),
      sseBuffer: '',
    };
  }

  function getOrCreateCurrentStreamMessage(context: StreamContext): {
    createdAt: string | null;
    messageId: string | null;
    role: ChatHistoryMessageRole;
    text: string;
    updatedAt: string | null;
  } {
    if (!context.currentMessageKey) {
      context.currentMessageKey = context.currentMessageId ?? `stream-${++context.anonymousMessageSequence}`;
    }

    const existing = context.messagesByKey.get(context.currentMessageKey);
    if (existing) {
      return existing;
    }

    const created = {
      createdAt: context.currentCreatedAt,
      messageId: context.currentMessageId,
      role: context.currentRole,
      text: '',
      updatedAt: context.currentUpdatedAt,
    };
    context.messagesByKey.set(context.currentMessageKey, created);
    return created;
  }

  function rekeyCurrentStreamMessage(context: StreamContext, nextMessageId: string): void {
    const normalizedMessageId = cleanupText(nextMessageId);
    if (!normalizedMessageId) {
      return;
    }

    const currentMessage = getOrCreateCurrentStreamMessage(context);
    const currentKey = context.currentMessageKey;
    context.currentMessageId = normalizedMessageId;

    if (currentKey === normalizedMessageId) {
      currentMessage.messageId = normalizedMessageId;
      return;
    }

    const existingTarget = context.messagesByKey.get(normalizedMessageId) ?? null;
    const mergedTarget = existingTarget
      ? {
          createdAt: currentMessage.createdAt ?? existingTarget.createdAt,
          messageId: normalizedMessageId,
          role: currentMessage.role !== 'unknown' ? currentMessage.role : existingTarget.role,
          text: currentMessage.text.length >= existingTarget.text.length ? currentMessage.text : existingTarget.text,
          updatedAt: currentMessage.updatedAt ?? existingTarget.updatedAt,
        }
      : {
          ...currentMessage,
          messageId: normalizedMessageId,
        };

    context.messagesByKey.set(normalizedMessageId, mergedTarget);
    if (currentKey && currentKey !== normalizedMessageId) {
      context.messagesByKey.delete(currentKey);

      const fieldEntries = Array.from(context.messageFieldBuffers.entries()).filter(([entryKey]) =>
        entryKey.startsWith(`${currentKey}::`),
      );
      for (const [entryKey, value] of fieldEntries) {
        context.messageFieldBuffers.delete(entryKey);
        context.messageFieldBuffers.set(`${normalizedMessageId}${entryKey.slice(currentKey.length)}`, value);
      }
    }

    context.currentMessageKey = normalizedMessageId;
  }

  function rebuildCurrentStreamMessageText(context: StreamContext): void {
    if (!context.currentMessageKey) {
      return;
    }

    const message = getOrCreateCurrentStreamMessage(context);
    const fieldPrefix = `${context.currentMessageKey}::`;
    const fragments = Array.from(context.messageFieldBuffers.entries())
      .filter(([entryKey]) => entryKey.startsWith(fieldPrefix))
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([, value]) => normalizePreviewText(value))
      .filter(Boolean);

    if (!fragments.length) {
      return;
    }

    message.text = Array.from(new Set(fragments)).join('\n\n');
  }

  function applyStreamMessageFieldOperation(
    context: StreamContext,
    fieldPath: string,
    operation: string,
    value: string,
  ): void {
    const message = getOrCreateCurrentStreamMessage(context);
    const fieldKey = `${context.currentMessageKey}::${fieldPath}`;
    const previous = context.messageFieldBuffers.get(fieldKey) ?? '';

    let nextValue = previous;
    if (operation === 'append') {
      nextValue = `${previous}${value}`;
    } else if (operation === 'replace' || operation === 'add') {
      nextValue = value;
    } else {
      return;
    }

    context.messageFieldBuffers.set(fieldKey, nextValue);
    message.messageId = context.currentMessageId ?? message.messageId;
    message.role = context.currentRole !== 'unknown' ? context.currentRole : message.role;
    message.createdAt = context.currentCreatedAt ?? message.createdAt;
    message.updatedAt = context.currentUpdatedAt ?? message.updatedAt;
    rebuildCurrentStreamMessageText(context);
  }

  function ingestStreamMessage(context: StreamContext, message: Record<string, unknown>): void {
    const messageId = normalizeOptionalText(message.id);
    if (messageId) {
      rekeyCurrentStreamMessage(context, messageId);
    }

    context.currentRole = normalizeMessageRole(isRecord(message.author) ? message.author.role : null);
    context.currentCreatedAt = normalizeChatTimestampToIso(message.create_time);
    context.currentUpdatedAt = normalizeChatTimestampToIso(message.update_time);

    const currentMessage = getOrCreateCurrentStreamMessage(context);
    currentMessage.messageId = context.currentMessageId ?? currentMessage.messageId;
    currentMessage.role = context.currentRole !== 'unknown' ? context.currentRole : currentMessage.role;
    currentMessage.createdAt = context.currentCreatedAt ?? currentMessage.createdAt;
    currentMessage.updatedAt = context.currentUpdatedAt ?? currentMessage.updatedAt;

    const extractedText = extractMessageText(message);
    if (extractedText) {
      currentMessage.text = extractedText;
    }
  }

  function processStreamPatchOperation(context: StreamContext, operation: unknown): void {
    if (!isRecord(operation)) {
      return;
    }

    const fieldPath = typeof operation.p === 'string' ? cleanupText(operation.p) : '';
    const action = typeof operation.o === 'string' ? cleanupText(operation.o) : '';
    const value = operation.v;

    if (fieldPath === '/message/id' && typeof value === 'string') {
      rekeyCurrentStreamMessage(context, value);
    }

    if (fieldPath === '/message/create_time') {
      context.currentCreatedAt = normalizeChatTimestampToIso(value);
    }

    if (fieldPath === '/message/update_time') {
      context.currentUpdatedAt = normalizeChatTimestampToIso(value);
    }

    if (fieldPath === '/message/author/role' && typeof value === 'string') {
      context.currentRole = normalizeMessageRole(value);
    }

    if (
      fieldPath &&
      typeof value === 'string' &&
      (fieldPath === '/message/content/text' || fieldPath.startsWith('/message/content/parts/'))
    ) {
      applyStreamMessageFieldOperation(context, fieldPath, action, value);
    }

    if (isRecord(value) && isRecord(value.message)) {
      ingestStreamMessage(context, value.message);
    }
  }

  function processStreamPayload(context: StreamContext, payload: unknown): void {
    const resolvedConversationId = resolveConversationIdFromStreamValue(payload);
    if (!context.conversationId && resolvedConversationId) {
      context.conversationId = resolvedConversationId;
    }

    if (!isRecord(payload)) {
      return;
    }

    if (isRecord(payload.message)) {
      ingestStreamMessage(context, payload.message);
    }

    if (isRecord(payload.input_message)) {
      ingestStreamMessage(context, payload.input_message);
    }

    if (isRecord(payload.v) && isRecord(payload.v.message)) {
      ingestStreamMessage(context, payload.v.message);
    }

    if (Array.isArray(payload.v)) {
      for (const entry of payload.v) {
        processStreamPatchOperation(context, entry);
      }
    }
  }

  function buildStreamHistoryRecord(context: StreamContext): {
    projectId: string;
    projectName: string | null;
    chatId: string;
    chatName: string | null;
    messageCount: number;
    messages: ExtractedChatHistoryMessage[];
    searchText: string;
    updatedAt: string | null;
    capturedAt: string;
    isPartial: true;
  } | null {
    if (!context.conversationId) {
      return null;
    }

    const projectId =
      knownConversationProjectIds.get(context.conversationId) ??
      extractProjectContextFromUrl(new URL(window.location.href, window.location.origin)).externalId;
    if (!projectId) {
      return null;
    }

    const partialMessages = Array.from(context.messagesByKey.values())
      .filter((message) => cleanupText(message.text))
      .sort(compareHistoryMessages);
    if (!partialMessages.length) {
      return null;
    }

    const messages: ExtractedChatHistoryMessage[] = partialMessages.map((message) => ({
      messageId: message.messageId,
      nodeId: null,
      parentMessageId: null,
      turnId: null,
      role: message.role,
      authorName: null,
      modelSlug: null,
      text: message.text,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      contentType: null,
      messageType: null,
      language: null,
      parts: null,
      children: null,
      isHidden: false,
      endTurn: null,
      status: null,
      reasoning: null,
      metadataJson: null,
      rawJson: null,
    }));

    registerSandboxFilesFromFinalAssistantMessages({
      projectId,
      projectName: knownProjectNames.get(projectId) ?? null,
      chatId: context.conversationId,
      messages,
    });

    return {
      projectId,
      projectName: knownProjectNames.get(projectId) ?? null,
      chatId: context.conversationId,
      chatName: knownChatNames.get(context.conversationId) ?? null,
      messageCount: messages.length,
      messages,
      searchText: buildHistorySearchText(messages),
      updatedAt: messages[messages.length - 1]?.updatedAt ?? messages[messages.length - 1]?.createdAt ?? null,
      capturedAt: new Date().toISOString(),
      isPartial: true,
    };
  }

  function emitStreamHistory(context: StreamContext, immediate = false): void {
    const flush = () => {
      context.emitTimer = null;
      const historyRecord = buildStreamHistoryRecord(context);
      if (!historyRecord) {
        return;
      }

      emitConversationHistory(historyRecord);
      logDebug(
        'info',
        `Captured live conversation stream: projectId="${historyRecord.projectId}" chatId="${historyRecord.chatId}" messages="${String(historyRecord.messageCount)}"`,
      );
    };

    if (immediate) {
      if (context.emitTimer !== null) {
        window.clearTimeout(context.emitTimer);
        context.emitTimer = null;
      }

      flush();
      return;
    }

    if (context.emitTimer !== null) {
      return;
    }

    context.emitTimer = window.setTimeout(flush, 500);
  }

  function processSseEventBlock(context: StreamContext, eventBlock: string): void {
    if (!eventBlock.trim()) {
      return;
    }

    const dataLines = eventBlock
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) {
      return;
    }

    const dataText = dataLines.join('\n').trim();
    if (!dataText) {
      return;
    }

    const parsedPayload = parseJson(dataText);
    if (parsedPayload !== null) {
      processStreamPayload(context, parsedPayload);
      emitStreamHistory(context);
      return;
    }

    if (!context.conversationId) {
      context.conversationId = resolveConversationIdFromDataText(dataText);
    }
  }

  function processLiveStreamChunk(context: StreamContext, chunkText: string): void {
    if (!chunkText) {
      return;
    }

    context.sseBuffer = `${context.sseBuffer}${chunkText}`.replace(/\r\n/g, '\n');
    const eventBlocks = context.sseBuffer.split('\n\n');
    context.sseBuffer = eventBlocks.pop() ?? '';

    for (const eventBlock of eventBlocks) {
      processSseEventBlock(context, eventBlock);
    }
  }

  function finalizeLiveStream(context: StreamContext): void {
    if (context.sseBuffer.trim()) {
      processSseEventBlock(context, context.sseBuffer);
      context.sseBuffer = '';
    }

    emitStreamHistory(context, true);
  }

  function applyConversationSnapshot(conversationId: string, snapshot: unknown, rawUrl: string): void {
    if (!conversationId || !isRecord(snapshot)) {
      return;
    }

    const projectId =
      pendingConversationProjectIds.get(conversationId) ??
      extractProjectIdFromValue(snapshot);
    const chatName = normalizeOptionalText(snapshot.title);

    rememberChatName(conversationId, chatName, 'snapshot');

    if (projectId) {
      knownConversationProjectIds.set(conversationId, projectId);
      pendingConversationProjectIds.delete(conversationId);
      rememberProjectName(projectId, extractProjectNameFromPayload(snapshot, projectId), 'response');
    }

    const historyRecord = extractConversationHistoryRecord(conversationId, snapshot, projectId);
    if (historyRecord) {
      emitConversationHistory(historyRecord);
      logDebug(
        'info',
        `Captured conversation history: projectId="${historyRecord.projectId}" chatId="${conversationId}" messages="${String(historyRecord.messageCount)}"`,
      );
    }

    logDebug(
      'info',
      `Captured conversation snapshot: projectId="${projectId ?? 'null'}" chatId="${conversationId}" chatTitle="${chatName ?? 'null'}"`,
    );
    scheduleEmit();
  }

  function applyProjectConversations(projectId: string, payload: unknown): void {
    if (!projectId || !isRecord(payload) || !Array.isArray(payload.items)) {
      return;
    }

    let capturedCount = 0;

    for (const item of payload.items) {
      if (!isRecord(item)) {
        continue;
      }

      const conversationId = normalizeOptionalText(item.id);
      const chatTitle = normalizeOptionalText(item.title);
      if (!conversationId || !chatTitle) {
        continue;
      }

      knownConversationProjectIds.set(conversationId, projectId);
      rememberChatName(conversationId, chatTitle, 'project-list');
      capturedCount += 1;
    }

    rememberProjectName(projectId, extractProjectNameFromPayload(payload, projectId), 'response');

    logDebug(
      'info',
      `Captured project conversation list: projectId="${projectId}" chatCount="${capturedCount}"`,
    );
    scheduleEmit();
  }

  async function handleFetchResponse(rawUrl: string, response: Response): Promise<void> {
    if (!response.ok) {
      return;
    }

    const conversationId = resolveSnapshotConversationId(rawUrl);
    if (conversationId) {
      try {
        const snapshot = await response.json();
        applyConversationSnapshot(conversationId, snapshot, rawUrl);
      } catch {
        logDebug('warn', `Unable to parse conversation snapshot response for "${conversationId}".`);
      }
      return;
    }

    const projectId = resolveProjectConversationsProjectId(rawUrl);
    if (!projectId) {
      return;
    }

    try {
      const payload = await response.json();
      applyProjectConversations(projectId, payload);
    } catch {
      logDebug('warn', `Unable to parse project conversation list for "${projectId}".`);
    }
  }

  async function handleLiveFetchResponse(
    rawUrl: string,
    requestConversationId: string | null,
    response: Response | null,
  ): Promise<void> {
    if (!isLiveConversationUrl(rawUrl) || !response || !response.ok) {
      return;
    }

    const context = createStreamContext(requestConversationId);
    const stream = response.body;
    if (!stream || typeof stream.getReader !== 'function') {
      try {
        processLiveStreamChunk(context, await response.text());
        finalizeLiveStream(context);
      } catch {
        logDebug('warn', 'Unable to parse live conversation stream text response.');
      }
      return;
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        processLiveStreamChunk(context, decoder.decode(value, { stream: true }));
      }

      processLiveStreamChunk(context, decoder.decode());
      finalizeLiveStream(context);
    } catch {
      logDebug('warn', 'Unable to parse live conversation stream chunks.');
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore release errors from page-owned streams.
      }
    }
  }

  function handleXhrResponse(rawUrl: string, responseText: string, status: number, projectIdHint: string | null): void {
    if (typeof responseText !== 'string' || status < 200 || status >= 300) {
      return;
    }

    const conversationId = resolveSnapshotConversationId(rawUrl);
    if (conversationId) {
      try {
        const snapshot = JSON.parse(responseText) as unknown;
        if (projectIdHint) {
          pendingConversationProjectIds.set(conversationId, projectIdHint);
        }
        applyConversationSnapshot(conversationId, snapshot, rawUrl);
      } catch {
        logDebug('warn', `Unable to parse XHR conversation snapshot for "${conversationId}".`);
      }
      return;
    }

    const projectId = resolveProjectConversationsProjectId(rawUrl);
    if (!projectId) {
      return;
    }

    try {
      const payload = JSON.parse(responseText) as unknown;
      applyProjectConversations(projectId, payload);
    } catch {
      logDebug('warn', `Unable to parse XHR project conversation list for "${projectId}".`);
    }
  }

  function handleLiveXhrResponse(rawUrl: string, requestConversationId: string | null, responseText: string, status: number): void {
    if (!isLiveConversationUrl(rawUrl) || typeof responseText !== 'string' || status < 200 || status >= 300) {
      return;
    }

    const context = createStreamContext(requestConversationId);
    processLiveStreamChunk(context, responseText);
    finalizeLiveStream(context);
  }

  function readPageContext(): {
    currentProjectId: string | null;
    currentProjectName: string | null;
    currentChatId: string | null;
    currentChatName: string | null;
    detectedAt: string;
    pageUrl: string | null;
    projectUrl: string | null;
    chatUrl: string | null;
  } | null {
    const url = parseSameOriginUrl(window.location.href);
    if (!url) {
      return null;
    }

    const conversationId = detectConversationIdFromUrl(url);
    const urlProjectContext = extractProjectContextFromUrl(url);
    const projectId =
      (conversationId ? knownConversationProjectIds.get(conversationId) ?? null : null) ??
      urlProjectContext.externalId;

    const pageUrl = serializeUrl(url);
    const projectUrl = deriveProjectUrl(url, projectId, conversationId);
    const chatUrl = conversationId ? pageUrl : null;

    return {
      currentProjectId: projectId,
      currentProjectName: projectId ? knownProjectNames.get(projectId) ?? null : null,
      currentChatId: conversationId,
      currentChatName: conversationId ? knownChatNames.get(conversationId) ?? null : null,
      detectedAt: new Date().toISOString(),
      pageUrl,
      projectUrl,
      chatUrl,
    };
  }

  function emitContext(): void {
    const context = readPageContext();
    if (!context) {
      logDebug('warn', 'Context scan skipped because the current page URL could not be parsed.');
      return;
    }

    const signature = JSON.stringify([
      context.currentProjectId,
      context.currentProjectName,
      context.currentChatId,
      context.currentChatName,
      context.pageUrl,
      context.projectUrl,
      context.chatUrl,
    ]);

    if (signature === lastSignature) {
      return;
    }

    lastSignature = signature;

    logDebug(
      'info',
      `Page context: project="${context.currentProjectName ?? 'null'}" projectId="${context.currentProjectId ?? 'null'}" projectUrl="${context.projectUrl ?? 'null'}" chat="${context.currentChatName ?? 'null'}" chatId="${context.currentChatId ?? 'null'}" chatUrl="${context.chatUrl ?? 'null'}" pageUrl="${context.pageUrl ?? 'null'}"`,
    );

    window.postMessage(
      {
        source: PAGE_CONTEXT_MESSAGE_SOURCE,
        payload: context,
      },
      '*',
    );
  }

  function scheduleEmit(): void {
    if (emitTimer !== null) {
      window.clearTimeout(emitTimer);
    }

    emitTimer = window.setTimeout(() => {
      emitTimer = null;
      emitContext();
    }, 120);
  }

  const wrapHistoryMethod = (methodName: 'pushState' | 'replaceState') => {
    const originalMethod = history[methodName];

    history[methodName] = function wrappedHistoryMethod(this: History, ...args: unknown[]): void {
      originalMethod.apply(this, args as never);
      scheduleEmit();
    };
  };

  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof window.fetch>): Promise<Response> => {
    const [input, init] = args;
    const rawUrl = input instanceof Request ? input.url : String(input);

    captureProjectIdHint(rawUrl, input instanceof Request ? input.headers : null);
    captureProjectIdHint(rawUrl, init?.headers);
    captureBackendHeadersFromRequest(rawUrl, input instanceof Request ? input.headers : null);
    captureBackendHeadersFromRequest(rawUrl, init?.headers);
    const requestBodyPromise = readRequestBody(input, init);
    void requestBodyPromise.then((bodyText) => {
      captureTitlePayloadFromBody(rawUrl, bodyText);
      if (isLiveConversationUrl(rawUrl)) {
        const requestConversationId = resolveConversationIdFromRequestBody(bodyText);
        captureConversationProjectHint(requestConversationId, input instanceof Request ? input.headers : null);
        captureConversationProjectHint(requestConversationId, init?.headers);
      }
    });

        const response = await originalFetch(...args);
    const snapshotResponse = cloneResponseSafely(response);
    const liveResponse = isLiveConversationUrl(rawUrl) ? cloneResponseSafely(response) : null;

    if (snapshotResponse) {
      void handleFetchResponse(rawUrl, snapshotResponse);
    }

    void (async () => {
      const requestBody = await requestBodyPromise;
      await handleLiveFetchResponse(rawUrl, resolveConversationIdFromRequestBody(requestBody), liveResponse);
    })();

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: TrackedXmlHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    this.__chatgptDesktopPocUrl = typeof url === 'string' ? url : String(url);
    this.__chatgptDesktopPocProjectIdHint = null;
    this.__chatgptDesktopPocConversationIdHint = null;
    (originalOpen as (...args: unknown[]) => void).apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(
    this: TrackedXmlHttpRequest,
    name: string,
    value: string,
  ): void {
    if (cleanupText(name).toLowerCase() === 'chatgpt-project-id') {
      this.__chatgptDesktopPocProjectIdHint = cleanupText(value) || null;
    }

    captureBackendHeaderValue(name, value);
    originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function patchedSend(this: TrackedXmlHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
    if (typeof body === 'string') {
      captureTitlePayloadFromBody(this.__chatgptDesktopPocUrl ?? '', body);
      this.__chatgptDesktopPocConversationIdHint = resolveConversationIdFromRequestBody(body);
      captureConversationProjectHint(
        this.__chatgptDesktopPocConversationIdHint ?? null,
        this.__chatgptDesktopPocProjectIdHint ? [['chatgpt-project-id', this.__chatgptDesktopPocProjectIdHint]] : null,
      );
    }

    this.addEventListener(
      'load',
      () => {
        handleXhrResponse(
          this.__chatgptDesktopPocUrl ?? '',
          this.responseText,
          this.status,
          this.__chatgptDesktopPocProjectIdHint ?? null,
        );
        handleLiveXhrResponse(
          this.__chatgptDesktopPocUrl ?? '',
          this.__chatgptDesktopPocConversationIdHint ?? null,
          this.responseText,
          this.status,
        );
      },
      { once: true },
    );

    originalSend.call(this, body);
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') {
      return;
    }

    const candidate = event.data as { payload?: unknown; source?: unknown };
    if (candidate.source === PAGE_APP_RESPONSE_MESSAGE_SOURCE) {
      handleAppResponseMessage(candidate.payload);
      return;
    }

    if (candidate.source === PAGE_APP_COMMAND_MESSAGE_SOURCE) {
      handleAppCommandMessage(candidate.payload);
    }
  });

  window.addEventListener('popstate', scheduleEmit);
  window.addEventListener('hashchange', scheduleEmit);
  window.addEventListener('load', scheduleEmit);
  document.addEventListener('readystatechange', scheduleEmit);

  window.setInterval(() => {
    emitContext();
  }, 2000);

  logDebug('info', 'Injected script bootstrapped at document start with network title capture.');
  emitContext();
})();
