import type { ChatHistoryRecord, PromptRecord } from '../../shared/contracts';

export type BrowserEditorTab = {
  id: 'browser';
  kind: 'browser';
  title: string;
};

export type PromptEditorTab = {
  id: string;
  kind: 'prompt';
  promptId: string;
  title: string;
  promptPath: string;
  promptRecord: PromptRecord | null;
  content: string;
  draftContent: string;
  status: 'loading' | 'ready' | 'error';
  message: string | null;
  isDirty: boolean;
  isEditing: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  saveMessage: string | null;
  requestToken: number;
  inFlightRequest: Promise<void> | null;
};

export type ChatEditorTab = {
  id: string;
  kind: 'chat';
  projectId: string;
  chatId: string;
  title: string;
  status: 'loading' | 'ready' | 'empty' | 'error';
  history: ChatHistoryRecord | null;
  message: string | null;
  requestToken: number;
  inFlightRequest: Promise<void> | null;
  reloadAfterLoad: boolean;
  historyRevisionKey: string | null;
  pendingHistoryRevisionKey: string | null;
  isHistoryStale: boolean;
  renderedContent: HTMLElement | null;
  historyScrollTop: number | null;
};

export type EditorTabState = BrowserEditorTab | ChatEditorTab | PromptEditorTab;
