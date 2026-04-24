import type { PromptRecord } from '../../shared/contracts';
import type { OverlayEventsHelpers } from './events';

export type OverlayControllerOptions = {
  findClosestHtmlElement: OverlayEventsHelpers['findClosestHtmlElement'];
  submitPromptNameDialog: (value: string) => Promise<void>;
  cancelPromptNameDialog: () => void;
  isPromptNameDialogOpen: () => boolean;
  getRemoteManifestPrompt: (projectId: string) => string;
  getEffectiveProjectId: (requestedProjectId: string) => string;
  writeClipboardText: (text: string) => Promise<void>;
  showRemoteFilesNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
  findLatestNewFileByKey: (fileKey: string) => { file: unknown } | null;
  closeArchiveApplyWarningDialog: () => void;
  runApplySandboxFile: (file: unknown, relativePath?: string | null) => Promise<unknown>;
  addDebugLog: (source: 'webview', level: 'info' | 'warn' | 'error', message: string, details?: string | null) => void;
  isArchiveApplyWarningOpen: () => boolean;
  closePropertiesDialog: () => void;
  isPropertiesDialogOpen: () => boolean;
  isActiveTreeMenuOpen: () => boolean;
  closeActiveTreeMenu: () => void;
  isActivePromptMenuOpen: () => boolean;
  closeActivePromptMenu: () => void;
  openPromptTab: (promptId: string) => Promise<void>;
  getPromptById: (promptId: string) => PromptRecord | null;
  openRenamePromptDialog: (promptId: string, initialValue: string) => void;
  confirm: (message: string) => boolean;
  deletePrompt: (promptId: string) => Promise<void>;
  alert: (message: string) => void;
  render: () => void;
};

export function createOverlayEventHelpers(options: OverlayControllerOptions): OverlayEventsHelpers {
  return {
    findClosestHtmlElement: options.findClosestHtmlElement,
    confirmPromptNameDialog: (value) => {
      void options.submitPromptNameDialog(value);
    },
    cancelPromptNameDialog: options.cancelPromptNameDialog,
    isPromptNameDialogOpen: options.isPromptNameDialogOpen,
    copyRemoteManifestPrompt: async (projectId) => {
      const promptText = options.getRemoteManifestPrompt(options.getEffectiveProjectId(projectId));
      if (!promptText) {
        return;
      }
      try {
        await options.writeClipboardText(promptText);
        options.showRemoteFilesNotice('Prompt copied to clipboard.', 'info');
      } catch (error: unknown) {
        options.showRemoteFilesNotice(error instanceof Error ? error.message : String(error), 'error');
      }
    },
    confirmArchiveApplyWarning: (fileKey, relativePath) => {
      const target = options.findLatestNewFileByKey(fileKey);
      options.closeArchiveApplyWarningDialog();
      if (!target) {
        return;
      }
      void options.runApplySandboxFile(target.file, relativePath ?? null).catch((error: unknown) => {
        options.showRemoteFilesNotice(error instanceof Error ? error.message : String(error), 'error');
        options.addDebugLog('webview', 'error', 'Failed to apply an archive after warning confirmation.', error instanceof Error ? error.message : String(error));
      });
    },
    cancelArchiveApplyWarning: options.closeArchiveApplyWarningDialog,
    isArchiveApplyWarningOpen: options.isArchiveApplyWarningOpen,
    closePropertiesDialog: options.closePropertiesDialog,
    isPropertiesDialogOpen: options.isPropertiesDialogOpen,
    isActiveTreeMenuOpen: options.isActiveTreeMenuOpen,
    closeActiveTreeMenu: options.closeActiveTreeMenu,
    isActivePromptMenuOpen: options.isActivePromptMenuOpen,
    closeActivePromptMenu: options.closeActivePromptMenu,
    openPrompt: async (promptId) => {
      try {
        await options.openPromptTab(promptId);
      } catch (error: unknown) {
        console.warn('[prompt] Failed to open prompt', error);
      }
    },
    renamePrompt: (promptId) => {
      const prompt = options.getPromptById(promptId);
      if (!prompt) {
        return;
      }
      options.openRenamePromptDialog(promptId, prompt.fileName);
    },
    deletePrompt: (promptId) => {
      const prompt = options.getPromptById(promptId);
      if (!promptId || !prompt) {
        return;
      }
      const confirmed = options.confirm(`Delete prompt "${prompt.title}"?`);
      if (!confirmed) {
        return;
      }
      void options.deletePrompt(promptId).catch((error: unknown) => {
        options.alert(error instanceof Error ? error.message : String(error));
        options.render();
      });
    },
  };
}
