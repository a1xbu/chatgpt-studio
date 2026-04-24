export type BrowserUrlChatRecord = {
  chatId: string;
  chatUrl: string | null;
};

export type BrowserUrlProjectRecord = {
  projectId: string;
  projectUrl: string | null;
  chats: BrowserUrlChatRecord[];
};

export function normalizeStoredUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return null;
  }
}

export function deriveProjectUrlFromChatUrl(chatUrl: string | null | undefined): string | null {
  const normalizedChatUrl = normalizeStoredUrl(chatUrl);
  if (!normalizedChatUrl) {
    return null;
  }

  try {
    const parsed = new URL(normalizedChatUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const conversationIndex = segments.lastIndexOf('c');
    if (conversationIndex < 0 || !segments[conversationIndex + 1]) {
      return parsed.toString();
    }

    segments.splice(conversationIndex, 2);
    parsed.pathname = segments.length ? `/${segments.join('/')}` : '/';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildProjectBrowserUrl(projectId: string): string {
  if (projectId.startsWith('g-p-')) {
    return `https://chatgpt.com/g/${encodeURIComponent(projectId)}`;
  }

  const url = new URL('https://chatgpt.com/');
  url.searchParams.set('project', projectId);
  return url.toString();
}

export function buildChatBrowserUrl(projectId: string, chatId: string, projectUrl: string | null): string {
  const normalizedProjectUrl = normalizeStoredUrl(projectUrl);
  if (normalizedProjectUrl) {
    try {
      const parsed = new URL(normalizedProjectUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const conversationIndex = segments.lastIndexOf('c');

      if (conversationIndex >= 0) {
        segments.splice(conversationIndex, Math.min(2, segments.length - conversationIndex));
      }

      segments.push('c', encodeURIComponent(chatId));
      parsed.pathname = `/${segments.join('/')}`;

      if (!projectId.startsWith('g-p-') && projectId && !parsed.searchParams.has('project')) {
        parsed.searchParams.set('project', projectId);
      }

      return parsed.toString();
    } catch {
      // Fall through to generic URL construction below.
    }
  }

  if (projectId.startsWith('g-p-')) {
    return `https://chatgpt.com/g/${encodeURIComponent(projectId)}/c/${encodeURIComponent(chatId)}`;
  }

  const fallback = new URL(`https://chatgpt.com/c/${encodeURIComponent(chatId)}`);
  if (projectId) {
    fallback.searchParams.set('project', projectId);
  }
  return fallback.toString();
}

export function findKnownProjectUrl(project: BrowserUrlProjectRecord): string | null {
  return (
    deriveProjectUrlFromChatUrl(project.projectUrl) ??
    project.chats.map((chat) => deriveProjectUrlFromChatUrl(chat.chatUrl)).find((candidate): candidate is string => Boolean(candidate)) ??
    null
  );
}

export function resolveProjectBrowserUrl(project: BrowserUrlProjectRecord): string {
  const knownProjectUrl = findKnownProjectUrl(project);
  if (knownProjectUrl) {
    return knownProjectUrl;
  }

  return buildProjectBrowserUrl(project.projectId);
}

export function resolveChatBrowserUrl(project: BrowserUrlProjectRecord, chat: BrowserUrlChatRecord): string {
  const knownChatUrl = normalizeStoredUrl(chat.chatUrl);
  if (knownChatUrl) {
    return knownChatUrl;
  }

  return buildChatBrowserUrl(project.projectId, chat.chatId, findKnownProjectUrl(project));
}
