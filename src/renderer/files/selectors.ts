import type { AppStateSnapshot, SidebarProject } from '../../shared/contracts';
import type { SidebarSelection } from '../sidebar/types';

export type FilesSelectorDependencies = {
  getSelectedSidebarItem: () => SidebarSelection | null;
  findPersistentSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
  findSidebarProject: (state: AppStateSnapshot, projectId: string) => SidebarProject | null;
};

export function getActiveSidebarProject(
  state: AppStateSnapshot,
  dependencies: FilesSelectorDependencies,
): SidebarProject | null {
  const selectedSidebarItem = dependencies.getSelectedSidebarItem();
  if (!selectedSidebarItem?.projectId) {
    return null;
  }

  return dependencies.findPersistentSidebarProject(state, selectedSidebarItem.projectId)
    ?? dependencies.findSidebarProject(state, selectedSidebarItem.projectId);
}
