
import type { AppStateSnapshot, ChatFileRecord, DebugLogEntry, PromptRecord, SidebarProject } from '../../shared/contracts';
import { bindBrowserChromeEvents } from '../browser/chrome';
import { createBottomPanelEventHelpers, type BottomPanelControllerOptions } from '../bottom-panel/controller';
import { bindBottomPanelEvents } from '../bottom-panel/events';
import type { ChatHistoryEventsHelpers } from '../chat/events';
import { bindChatHistoryEvents } from '../chat/events';
import type { LocalProjectFileEntry } from '../desktop-api';
import { bindEditorTabsEvents, type EditorTabsEventsHelpers } from '../editor/events';
import { createLocalFilesEventHelpers, type LocalFilesControllerOptions } from '../files/controller';
import { bindLocalFilesEvents } from '../files/events';
import { createGitPanelEventHelpers, type GitPanelControllerOptions } from '../git/controller';
import { bindGitPanelEvents } from '../git/events';
import { createOverlayEventHelpers, type OverlayControllerOptions } from '../overlay/controller';
import { bindOverlayEvents } from '../overlay/events';
import { bindPromptEvents, type PromptEventsHelpers } from '../prompts/events';
import { createRemoteFilesEventHelpers, type RemoteFilesControllerOptions } from '../remote-files/controller';
import { bindRemoteFilesEvents } from '../remote-files/events';
import { createProjectTreeEventHelpers, createSidebarActivityHelpers, type ProjectTreeControllerOptions, type SidebarActivityControllerOptions } from '../sidebar/controller';
import { bindProjectTreeEvents, bindSidebarActivityEvents } from '../sidebar/events';
import type { PromptMenuState, SidebarSelection, TreeMenuState } from '../sidebar/types';

export type InstallRendererBindingsElements = {
  sidebarActivityElement: HTMLElement | null;
  projectListElement: HTMLElement | null;
  newFilesPanelElement: HTMLElement | null;
  fileViewPanelElement: HTMLElement | null;
  promptViewPanelElement: HTMLElement | null;
  promptEditorViewElement: HTMLElement | null;
  editorTabsElement: HTMLElement | null;
  backButton: HTMLButtonElement | null;
  forwardButton: HTMLButtonElement | null;
  refreshStopButton: HTMLButtonElement | null;
  browserAddressFormElement: HTMLFormElement | null;
  browserUrlElement: HTMLInputElement | null;
  browserElement: Element | null;
  toggleBottomPanelButton: HTMLButtonElement | null;
  copyDebugButton: HTMLButtonElement | null;
  clearDebugButton: HTMLButtonElement | null;
  openTerminalButton: HTMLButtonElement | null;
  bottomTabsElement: HTMLElement | null;
  debugFilterInputElement: HTMLInputElement | null;
  debugRetentionElement: HTMLElement | null;
  gitViewElement: HTMLElement | null;
  overlayRootElement: HTMLElement;
  chatHistoryViewElement: HTMLElement | null;
};

export type InstallRendererBindingsOptions = {
  elements: InstallRendererBindingsElements;
  sidebarActivityOptions: SidebarActivityControllerOptions;
  localFilesOptions: LocalFilesControllerOptions;
  promptEventsHelpers: PromptEventsHelpers;
  normalizeBrowserAddress: (value: string) => string;
  openBrowserUrl: (url: string) => void;
  editorTabsHelpers: EditorTabsEventsHelpers;
  bottomPanelOptions: BottomPanelControllerOptions;
  gitPanelOptions: GitPanelControllerOptions;
  projectTreeOptions: ProjectTreeControllerOptions;
  overlayOptions: OverlayControllerOptions;
  chatHistoryHelpers: ChatHistoryEventsHelpers;
  remoteFilesOptions: RemoteFilesControllerOptions;
};

export function installRendererBindings(options: InstallRendererBindingsOptions): void {
  bindSidebarActivityEvents(
    {
      sidebarActivityElement: options.elements.sidebarActivityElement,
      projectListElement: options.elements.projectListElement,
    },
    createSidebarActivityHelpers(options.sidebarActivityOptions),
  );

  bindLocalFilesEvents(
    {
      fileViewPanelElement: options.elements.fileViewPanelElement,
    },
    createLocalFilesEventHelpers(options.localFilesOptions),
  );

  bindPromptEvents(
    {
      promptViewPanelElement: options.elements.promptViewPanelElement,
      promptEditorViewElement: options.elements.promptEditorViewElement,
    },
    options.promptEventsHelpers,
  );

  bindBrowserChromeEvents(
    {
      backButton: options.elements.backButton,
      forwardButton: options.elements.forwardButton,
      refreshStopButton: options.elements.refreshStopButton,
      browserAddressFormElement: options.elements.browserAddressFormElement,
      browserUrlElement: options.elements.browserUrlElement,
      browserElement: options.elements.browserElement as never,
    },
    {
      normalizeBrowserAddress: options.normalizeBrowserAddress,
      openBrowserUrl: options.openBrowserUrl,
    },
  );

  bindEditorTabsEvents(
    {
      editorTabsElement: options.elements.editorTabsElement,
    },
    options.editorTabsHelpers,
  );

  bindBottomPanelEvents(
    {
      toggleBottomPanelButton: options.elements.toggleBottomPanelButton,
      copyDebugButton: options.elements.copyDebugButton,
      clearDebugButton: options.elements.clearDebugButton,
      openTerminalButton: options.elements.openTerminalButton,
      bottomTabsElement: options.elements.bottomTabsElement,
      debugFilterInputElement: options.elements.debugFilterInputElement,
      debugRetentionElement: options.elements.debugRetentionElement,
    },
    createBottomPanelEventHelpers(options.bottomPanelOptions),
  );

  bindGitPanelEvents(
    {
      gitViewElement: options.elements.gitViewElement,
    },
    createGitPanelEventHelpers(options.gitPanelOptions),
  );

  bindProjectTreeEvents(
    {
      sidebarActivityElement: options.elements.sidebarActivityElement,
      projectListElement: options.elements.projectListElement,
    },
    createProjectTreeEventHelpers(options.projectTreeOptions),
  );

  bindOverlayEvents(
    {
      overlayRootElement: options.elements.overlayRootElement,
      documentLike: document,
    },
    createOverlayEventHelpers(options.overlayOptions),
  );

  bindChatHistoryEvents(
    {
      chatHistoryViewElement: options.elements.chatHistoryViewElement,
    },
    options.chatHistoryHelpers,
  );

  bindRemoteFilesEvents(
    {
      newFilesPanelElement: options.elements.newFilesPanelElement,
    },
    createRemoteFilesEventHelpers(options.remoteFilesOptions),
  );
}
