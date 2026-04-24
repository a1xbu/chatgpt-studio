export type SidebarTabId = 'explorer' | 'files' | 'prompts';

export type SidebarSelection =
  | {
      kind: 'project';
      projectId: string;
    }
  | {
      kind: 'chat';
      projectId: string;
      chatId: string;
    };

export type TreeMenuState =
  | {
      kind: 'project';
      projectId: string;
    }
  | {
      kind: 'chat';
      projectId: string;
      chatId: string;
    };

export type PromptMenuState = {
  promptId: string;
};

export type PropertiesDialogState = TreeMenuState | null;

export type ArchiveApplyWarningDialogState = {
  fileKey: string;
  relativePath?: string | null;
};

export type PromptNameDialogState = {
  mode: 'create' | 'rename';
  promptId: string | null;
  title: string;
  initialValue: string;
  confirmLabel: string;
  errorMessage: string | null;
};
