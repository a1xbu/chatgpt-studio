import type { LocalFilesEventsHelpers } from './events';
import type { LocalProjectFileEntry } from '../desktop-api';

export type LocalFilesControllerOptions = {
  findClosestHtmlElement: LocalFilesEventsHelpers['findClosestHtmlElement'];
  openFolder: (folderPath: string) => Promise<unknown> | void;
  refreshLocalProjectTree: (projectId: string) => void;
  getCurrentState: () => unknown | null;
  renderFileViewPanel: (state: unknown, preserveScroll?: boolean) => void;
  projectBundleCreateInFlightIds: Set<string>;
  projectBundleErrorsByProjectId: Map<string, string>;
  createProjectBundle: (projectId: string) => Promise<unknown>;
  expandedLocalDirectoryKeys: Set<string>;
  getLocalFileTreeKey: (projectId: string, relativePath?: string) => string;
  localFileEntriesByKey: Map<string, LocalProjectFileEntry[]>;
  loadLocalFileTree: (projectId: string, relativePath?: string) => Promise<void> | void;
  startFileDrag: (fullPath: string) => void;
};

export function createLocalFilesEventHelpers(options: LocalFilesControllerOptions): LocalFilesEventsHelpers {
  return {
    findClosestHtmlElement: options.findClosestHtmlElement,
    openFolder: options.openFolder,
    refreshProjectFiles: (projectId) => {
      options.refreshLocalProjectTree(projectId);
      const currentState = options.getCurrentState();
      if (currentState) {
        options.renderFileViewPanel(currentState, true);
      }
    },
    createProjectBundle: (projectId) => {
      if (!projectId || options.projectBundleCreateInFlightIds.has(projectId)) {
        return;
      }

      options.projectBundleCreateInFlightIds.add(projectId);
      options.projectBundleErrorsByProjectId.delete(projectId);
      const currentState = options.getCurrentState();
      if (currentState) {
        options.renderFileViewPanel(currentState, true);
      }

      void options.createProjectBundle(projectId)
        .then(() => {
          options.refreshLocalProjectTree(projectId);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to create project bundle.';
          options.projectBundleErrorsByProjectId.set(projectId, message);
        })
        .finally(() => {
          options.projectBundleCreateInFlightIds.delete(projectId);
          const latestState = options.getCurrentState();
          if (latestState) {
            options.renderFileViewPanel(latestState, true);
          }
        });
    },
    toggleDirectory: (projectId, relativePath) => {
      const key = options.getLocalFileTreeKey(projectId, relativePath);
      if (options.expandedLocalDirectoryKeys.has(key)) {
        options.expandedLocalDirectoryKeys.delete(key);
        const currentState = options.getCurrentState();
        if (currentState) {
          options.renderFileViewPanel(currentState, true);
        }
        return;
      }

      options.expandedLocalDirectoryKeys.add(key);
      if (!options.localFileEntriesByKey.has(key)) {
        void options.loadLocalFileTree(projectId, relativePath);
      }
      const currentState = options.getCurrentState();
      if (currentState) {
        options.renderFileViewPanel(currentState, true);
      }
    },
    startFileDrag: options.startFileDrag,
  };
}
