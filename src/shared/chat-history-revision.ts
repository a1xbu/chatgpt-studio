import type { ChatHistoryMessageRecord, ChatHistoryRecord } from './contracts';

export type ChatHistoryRevisionInput = Pick<ChatHistoryRecord, 'capturedAt' | 'updatedAt' | 'messageCount' | 'isPartial'> & {
  messages?: readonly Pick<ChatHistoryMessageRecord, 'messageId' | 'createdAt' | 'updatedAt' | 'text'>[];
};

export function getChatHistoryRevisionKey(history: ChatHistoryRevisionInput): string {
  const lastMessage = history.messages?.length
    ? history.messages[history.messages.length - 1]
    : null;

  return [
    history.updatedAt ?? '',
    history.capturedAt,
    String(history.messageCount),
    history.isPartial === true ? 'partial' : 'complete',
    lastMessage?.messageId ?? '',
    lastMessage?.updatedAt ?? '',
    lastMessage?.createdAt ?? '',
    String(lastMessage?.text.length ?? 0),
  ].join('::');
}
