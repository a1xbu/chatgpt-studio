export type SharedFileTreeToggleMode = 'expandable' | 'expanded-static' | 'placeholder';

export type SharedFileTreeRowModel = {
  kind: 'file' | 'directory';
  name: string;
  depth: number;
  iconMarkup: string;
  title?: string | null;
  toggleMode: SharedFileTreeToggleMode;
  expanded?: boolean;
  rowClassNames?: string[];
  rowAttributes?: Record<string, string | null | undefined>;
  draggable?: boolean;
  clickAction?: string | null;
  contextMenuAction?: string | null;
  actionMarkup?: string;
  actionsClassNames?: string[];
  childrenMarkup?: string;
};

export type SharedFileTreeActionButtonModel = {
  action: string;
  title: string;
  iconMarkup: string;
  rowKind?: SharedFileTreeRowModel['kind'];
  classNames?: string[];
  attributes?: Record<string, string | boolean | null | undefined>;
  disabled?: boolean;
};

export type SharedFileTreeMarkupHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  renderChevronIcon: () => string;
};

function renderAttributeMarkup(
  attributes: Record<string, string | boolean | null | undefined> | undefined,
  escapeHtml: SharedFileTreeMarkupHelpers['escapeHtml'],
): string {
  return Object.entries(attributes ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ` ${key}="${escapeHtml(String(value))}"`)
    .join('');
}

export function renderSharedFileTreeToggle(
  mode: SharedFileTreeToggleMode,
  helpers: SharedFileTreeMarkupHelpers,
  expanded = false,
): string {
  switch (mode) {
    case 'expandable':
      return `<span class="file-tree__toggle ${expanded ? 'file-tree__toggle--expanded' : ''}">${helpers.renderChevronIcon()}</span>`;
    case 'expanded-static':
      return `<span class="file-tree__toggle file-tree__toggle--expanded file-tree__toggle--static">${helpers.renderChevronIcon()}</span>`;
    default:
      return '<span class="file-tree__toggle file-tree__toggle--placeholder"></span>';
  }
}

export function renderSharedFileTreeItem(
  model: SharedFileTreeRowModel,
  helpers: SharedFileTreeMarkupHelpers,
): string {
  const rowClasses = ['file-tree__row', ...(model.rowClassNames ?? [])]
    .filter(Boolean)
    .join(' ');
  const actionClasses = ['file-tree__actions', ...(model.actionsClassNames ?? [])]
    .filter(Boolean)
    .join(' ');
  const attributeMarkup = renderAttributeMarkup(model.rowAttributes, helpers.escapeHtml);
  const titleMarkup = model.title ? ` title="${helpers.escapeHtml(model.title)}"` : '';
  const clickActionMarkup = model.clickAction ? ` data-action="${helpers.escapeHtml(model.clickAction)}"` : '';
  const contextMenuActionMarkup = model.contextMenuAction ? ` data-context-menu-action="${helpers.escapeHtml(model.contextMenuAction)}"` : '';
  const draggableMarkup = model.draggable ? ' draggable="true"' : '';
  const childrenMarkup = model.childrenMarkup ? `<div class="file-tree__children">${model.childrenMarkup}</div>` : '';

  return `
    <div class="file-tree__item">
      <div
        class="${rowClasses}"
        ${clickActionMarkup}${contextMenuActionMarkup}${attributeMarkup}${draggableMarkup}${titleMarkup}
        style="--file-tree-depth:${model.depth};"
      >
        ${renderSharedFileTreeToggle(model.toggleMode, helpers, model.expanded)}
        <span class="file-tree__icon">${model.iconMarkup}</span>
        <span class="file-tree__label">${helpers.escapeHtml(model.name)}</span>
        <span class="${actionClasses}">${model.actionMarkup ?? ''}</span>
      </div>
      ${childrenMarkup}
    </div>
  `;
}


export function createSharedFileTreeItemRenderer(
  helpers: SharedFileTreeMarkupHelpers,
): (model: SharedFileTreeRowModel) => string {
  return (model) => renderSharedFileTreeItem(model, helpers);
}

export function createSharedFileTreeActionButtonRenderer(
  helpers: Pick<SharedFileTreeMarkupHelpers, 'escapeHtml'>,
): (model: SharedFileTreeActionButtonModel) => string {
  return (model) => renderSharedFileTreeActionButton(model, helpers);
}

export function renderSharedFileTreeActionButton(
  model: SharedFileTreeActionButtonModel,
  helpers: Pick<SharedFileTreeMarkupHelpers, 'escapeHtml'>,
): string {
  const className = ['file-tree__action-button', ...(model.classNames ?? [])]
    .filter(Boolean)
    .join(' ');
  const attributeMarkup = renderAttributeMarkup(model.attributes, helpers.escapeHtml);
  const buttonAction = helpers.escapeHtml(model.action);
  const buttonTitle = helpers.escapeHtml(model.title);
  const rowKind = model.rowKind ? ` data-row-kind="${helpers.escapeHtml(model.rowKind)}"` : '';

  return `
    <button
      class="${className}"
      data-action="${buttonAction}"
      title="${buttonTitle}"
      aria-label="${buttonTitle}"
      type="button"
      ${model.disabled ? 'disabled' : ''}${rowKind}${attributeMarkup}
    >
      ${model.iconMarkup}
    </button>
  `;
}
