import type { AppStateSnapshot, ChatFileRecord, SidebarProject } from '../../shared/contracts';
import { renderFileViewPanel as renderFileViewPanelImpl, renderProjectTreePanel as renderProjectTreePanelImpl, renderPromptSidebarPanel as renderPromptSidebarPanelImpl, type WorkbenchPanelRenderElements } from './workbench';
import type { SidebarSelection } from '../sidebar/types';

export type RootRenderNewFileEntry = {
  project: SidebarProject;
  file: ChatFileRecord;
};

export type RenderWorkbenchRootOptions = {
  currentState: AppStateSnapshot | null;
  selectedSidebarItem: SidebarSelection | null;
  projectListElement: HTMLElement | null;
  fileViewPanelElement: HTMLElement | null;
  promptViewPanelElement: HTMLElement | null;
  getAllSidebarProjects: (state: AppStateSnapshot) => SidebarProject[];
  getLatestNewFiles: (projects: SidebarProject[], selectedSidebarItem: SidebarSelection | null) => RootRenderNewFileEntry[];
  applySidebarDetailsState: (hasNewFiles: boolean) => void;
  applySidebarTabState: () => void;
  syncSidebarSelection: (state: AppStateSnapshot) => void;
  syncBrowserOpenedSelection: (state: AppStateSnapshot) => void;
  ensureLocalFileTreeForState: (state: AppStateSnapshot) => void;
  syncGitPanelWithCurrentProject: () => void;
  renderEditorArea: () => void;
  renderProjectTree: (state: AppStateSnapshot) => string;
  renderLocalFileViewPanel: (state: AppStateSnapshot) => string;
  renderPromptViewPanel: () => string;
  renderPromptMenuPortal: () => void;
  renderNewFilesPanel: (state: AppStateSnapshot) => void;
  renderOverlayDialog: () => void;
  renderDebugLogs: () => void;
  renderBottomPanel: () => void;
};

export function renderWorkbenchRoot(options: RenderWorkbenchRootOptions): void {
  if (!options.currentState || !options.projectListElement) {
    return;
  }

  const workbenchElements: WorkbenchPanelRenderElements = {
    projectListElement: options.projectListElement,
    fileViewPanelElement: options.fileViewPanelElement,
    promptViewPanelElement: options.promptViewPanelElement,
  };

  const latestNewFiles = options.getLatestNewFiles(
    options.getAllSidebarProjects(options.currentState),
    options.selectedSidebarItem,
  );

  options.applySidebarDetailsState(latestNewFiles.length > 0);
  options.applySidebarTabState();
  options.syncSidebarSelection(options.currentState);
  options.syncBrowserOpenedSelection(options.currentState);
  options.ensureLocalFileTreeForState(options.currentState);
  options.syncGitPanelWithCurrentProject();
  options.renderEditorArea();
  renderProjectTreePanelImpl(options.currentState, workbenchElements, options.renderProjectTree);
  renderFileViewPanelImpl(options.currentState, workbenchElements, options.renderLocalFileViewPanel);
  renderPromptSidebarPanelImpl(workbenchElements, options.renderPromptViewPanel, options.renderPromptMenuPortal);
  options.renderNewFilesPanel(options.currentState);
  options.renderOverlayDialog();
  options.renderDebugLogs();
  options.renderBottomPanel();
}
