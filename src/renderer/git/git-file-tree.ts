import type { SharedFileTreeRowModel } from '../tree/shared-tree';

export type GitTreeTone = 'neutral' | 'added' | 'modified' | 'deleted';

export type GitFileTreeNode = {
  kind: 'directory' | 'file';
  name: string;
  fullPath: string;
  tone: GitTreeTone;
  status: string | null;
  children: GitFileTreeNode[];
};

export type GitCommitFileTreeRecord = {
  path: string;
  status: string;
  oldPath?: string | null;
};

export type GitFileTreeRenderHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  renderFolderTreeIcon: (expanded: boolean) => string;
  renderFileTreeFileIcon: () => string;
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
  getGitStatusLabel: (status: string | null | undefined) => string;
  getGitCommitDirectoryKey: (commitHash: string, relativePath?: string) => string;
  isDirectoryCollapsed: (directoryKey: string) => boolean;
};

export function getGitTreeTone(status: string | null | undefined): GitTreeTone {
  const code = (status ?? '').trim().toUpperCase();
  if (code === 'A') {
    return 'added';
  }
  if (code === 'D') {
    return 'deleted';
  }
  if (code) {
    return 'modified';
  }
  return 'neutral';
}

export function mergeGitTreeTone(left: GitTreeTone, right: GitTreeTone): GitTreeTone {
  const score = { neutral: 0, added: 1, modified: 2, deleted: 3 } satisfies Record<GitTreeTone, number>;
  return score[right] > score[left] ? right : left;
}

export function buildGitFileTree(files: readonly GitCommitFileTreeRecord[]): GitFileTreeNode[] {
  const root: GitFileTreeNode = {
    kind: 'directory',
    name: '',
    fullPath: '',
    tone: 'neutral',
    status: null,
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    if (!parts.length) {
      continue;
    }

    let currentNode = root;
    let currentPath = '';
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let nextNode = currentNode.children.find((child) => child.name === part && child.kind === (isFile ? 'file' : 'directory'));
      if (!nextNode) {
        nextNode = {
          kind: isFile ? 'file' : 'directory',
          name: part,
          fullPath: currentPath,
          tone: 'neutral',
          status: null,
          children: [],
        };
        currentNode.children.push(nextNode);
      }

      if (isFile) {
        nextNode.status = file.status;
        nextNode.tone = getGitTreeTone(file.status);
      }
      currentNode = nextNode;
    });
  }

  const finalizeNode = (node: GitFileTreeNode): void => {
    node.children.forEach(finalizeNode);
    if (node.kind === 'directory') {
      node.children.sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === 'directory' ? -1 : 1;
        }
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
      });
      node.tone = node.children.reduce<GitTreeTone>((tone, child) => mergeGitTreeTone(tone, child.tone), 'neutral');
    }
  };

  finalizeNode(root);
  return root.children;
}

export function renderGitFileTreeNodes(
  commitHash: string,
  nodes: readonly GitFileTreeNode[],
  helpers: GitFileTreeRenderHelpers,
  depth = 0,
): string {
  return nodes
    .map((node) => {
      const isDirectory = node.kind === 'directory';
      const directoryKey = isDirectory ? helpers.getGitCommitDirectoryKey(commitHash, node.fullPath) : '';
      const expanded = isDirectory ? !helpers.isDirectoryCollapsed(directoryKey) : false;
      const rowClassNames = [
        isDirectory ? 'file-tree__row--directory' : 'file-tree__row--file',
        'file-tree__row--git-commit',
        !isDirectory && node.tone !== 'neutral' ? `file-tree__row--git-${node.tone}` : '',
      ].filter(Boolean);
      const actionMarkup = node.kind === 'file' && node.status
        ? `<span class="git-file-tree__status">${helpers.escapeHtml(helpers.getGitStatusLabel(node.status))}</span>`
        : '';

      return helpers.renderSharedFileTreeItem({
        kind: node.kind,
        name: node.name,
        depth,
        iconMarkup: isDirectory ? helpers.renderFolderTreeIcon(expanded) : helpers.renderFileTreeFileIcon(),
        title: node.fullPath,
        toggleMode: isDirectory ? 'expandable' : 'placeholder',
        expanded,
        rowClassNames,
        rowAttributes: isDirectory
          ? {
              'data-commit-hash': commitHash,
              'data-relative-path': node.fullPath,
            }
          : undefined,
        clickAction: isDirectory ? 'toggle-git-commit-directory' : null,
        actionMarkup,
        actionsClassNames: actionMarkup ? ['git-file-tree__actions'] : [],
        childrenMarkup: isDirectory && expanded ? renderGitFileTreeNodes(commitHash, node.children, helpers, depth + 1) : '',
      });
    })
    .join('');
}
