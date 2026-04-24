import type { SharedFileTreeRowModel } from './shared-tree';

export type LocalProjectFileTreeEntry = {
  name: string;
  relativePath: string;
  fullPath: string;
  kind: 'file' | 'directory';
  hasChildren: boolean;
  modifiedAt: string | null;
  createdAt: string | null;
  containsRecentModifiedFiles: boolean;
  isGitIgnored: boolean;
};

export type LocalFileTreeActivity = 'unchanged' | 'new' | 'modified';

export type LocalFileTreeRenderHelpers = {
  renderFolderTreeIcon: (expanded: boolean) => string;
  renderFileTreeFileIcon: () => string;
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
};

export type LocalFileTreeRenderOptions = {
  projectId: string;
  relativePath?: string;
  entries: readonly LocalProjectFileTreeEntry[];
  isExpanded: (relativePath: string) => boolean;
  getDepth: (relativePath: string) => number;
  classifyActivity: (entry: LocalProjectFileTreeEntry) => LocalFileTreeActivity;
  renderChildren: (relativePath: string) => string;
};

export function renderLocalFileTreeRows(
  options: LocalFileTreeRenderOptions,
  helpers: LocalFileTreeRenderHelpers,
): string {
  const relativePath = options.relativePath ?? '';
  if (!options.entries.length) {
    return relativePath ? '' : '<div class="file-view-empty">This project folder is empty.</div>';
  }

  return options.entries.map((entry) => {
    const isDirectory = entry.kind === 'directory';
    const expanded = isDirectory && options.isExpanded(entry.relativePath);
    const depth = options.getDepth(entry.relativePath);
    const childrenMarkup = expanded ? options.renderChildren(entry.relativePath) : '';
    const iconMarkup = isDirectory ? helpers.renderFolderTreeIcon(expanded) : helpers.renderFileTreeFileIcon();
    const titleText = isDirectory ? entry.relativePath || entry.name : `${entry.relativePath}\nDrag into ChatGPT to upload`;
    const activity = options.classifyActivity(entry);

    return helpers.renderSharedFileTreeItem({
      kind: entry.kind,
      name: entry.name,
      depth,
      iconMarkup,
      title: titleText,
      toggleMode: isDirectory ? 'expandable' : 'placeholder',
      expanded,
      rowClassNames: [
        isDirectory ? 'file-tree__row--directory' : 'file-tree__row--file',
        !isDirectory ? 'file-tree__row--draggable' : '',
        activity === 'new' ? 'file-tree__row--new' : '',
        activity === 'modified' ? 'file-tree__row--recent' : '',
        isDirectory && entry.containsRecentModifiedFiles ? 'file-tree__row--recent-directory' : '',
        entry.isGitIgnored ? 'file-tree__row--ignored' : '',
      ],
      rowAttributes: {
        'data-project-id': options.projectId,
        'data-relative-path': entry.relativePath,
        'data-full-path': entry.fullPath,
      },
      draggable: !isDirectory,
      clickAction: isDirectory ? 'toggle-local-directory' : null,
      childrenMarkup,
    });
  }).join('');
}
