import type { SharedFileTreeActionButtonModel, SharedFileTreeRowModel } from '../tree/shared-tree';

export type PromptTreePromptRecord = {
  id: string;
  fileName: string;
  fullPath: string;
};

export type PromptTreeRenderHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  renderFileTreeFileIcon: () => string;
  renderSharedFileTreeItem: (model: SharedFileTreeRowModel) => string;
  renderSharedFileTreeActionButton: (model: SharedFileTreeActionButtonModel) => string;
  renderMoreActionsIcon: () => string;
};

export type PromptRowRenderState = {
  isMenuOpen: boolean;
  isActive: boolean;
};

export function renderPromptItemMenu(
  prompt: PromptTreePromptRecord,
  helpers: Pick<PromptTreeRenderHelpers, 'escapeHtml'>,
): string {
  return `
    <div class="tree-row__menu" role="menu">
      <button class="tree-row__menu-item" data-action="open-prompt" data-prompt-id="${helpers.escapeHtml(prompt.id)}" type="button">Open</button>
      <button class="tree-row__menu-item" data-action="rename-prompt" data-prompt-id="${helpers.escapeHtml(prompt.id)}" type="button">Rename</button>
      <button class="tree-row__menu-item" data-action="delete-prompt" data-prompt-id="${helpers.escapeHtml(prompt.id)}" type="button">Delete</button>
    </div>
  `;
}

export function renderPromptRow(
  prompt: PromptTreePromptRecord,
  state: PromptRowRenderState,
  helpers: PromptTreeRenderHelpers,
): string {
  const titleText = `${prompt.fullPath}\nDrag to paste prompt text`;

  return helpers.renderSharedFileTreeItem({
    kind: 'file',
    name: prompt.fileName,
    depth: 0,
    iconMarkup: helpers.renderFileTreeFileIcon(),
    title: titleText,
    toggleMode: 'placeholder',
    rowClassNames: [
      'file-tree__row--file',
      'file-tree__row--draggable',
      'prompt-tree__row',
      state.isMenuOpen ? 'file-tree__row--menu-open' : '',
      state.isActive ? 'file-tree__row--active' : '',
    ],
    rowAttributes: {
      'data-prompt-id': prompt.id,
      'data-dblclick-action': 'open-prompt',
    },
    draggable: true,
    contextMenuAction: 'open-prompt-menu',
    actionMarkup: helpers.renderSharedFileTreeActionButton({
      action: 'toggle-prompt-menu',
      title: 'More actions',
      iconMarkup: helpers.renderMoreActionsIcon(),
      rowKind: 'file',
      attributes: {
        'data-prompt-id': prompt.id,
        'aria-expanded': String(state.isMenuOpen),
      },
    }),
  });
}
