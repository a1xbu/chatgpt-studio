import type { ChatHistoryMessageRecord } from '../../shared/contracts';

export function formatChatMessageTimestamp(
  message: ChatHistoryMessageRecord,
  formatTimestamp: (value: string | null | undefined) => string,
): string {
  return formatTimestamp(message.createdAt ?? message.updatedAt);
}

export function formatChatMessageRole(role: ChatHistoryMessageRecord['role']): string {
  switch (role) {
    case 'assistant':
      return 'Assistant';
    case 'tool':
      return 'Tool';
    case 'user':
      return 'User';
    case 'system':
      return 'System';
    default:
      return 'Unknown';
  }
}

export function wrapTextAsMarkdownCodeFence(rawText: string): string {
  const matches: string[] = rawText.match(/`+/g) ?? [];
  const longestFence = matches.reduce<number>((maxLength, segment) => Math.max(maxLength, segment.length), 0);
  const fence = '`'.repeat(Math.max(3, longestFence + 1));
  return `${fence}\n${rawText}\n${fence}`;
}
