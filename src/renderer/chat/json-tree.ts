export type JsonTreeValue = null | boolean | number | string | JsonTreeValue[] | { [key: string]: JsonTreeValue | undefined };

export type JsonTreeOptions = {
  stringPreviewLength?: number;
  rootLabel?: string;
};

const DEFAULT_STRING_PREVIEW_LENGTH = 360;
const MAX_EAGER_CHILDREN = 80;

type PrimitiveValue = null | boolean | number | string;

function isJsonObject(value: JsonTreeValue): value is { [key: string]: JsonTreeValue | undefined } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getTypeName(value: JsonTreeValue): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `Array(${String(value.length)})`;
  }

  if (isJsonObject(value)) {
    return `Object(${String(Object.keys(value).length)})`;
  }

  return typeof value;
}

function getChildEntries(value: JsonTreeValue): Array<[string, JsonTreeValue]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [String(index), entry]);
  }

  if (isJsonObject(value)) {
    return Object.entries(value).map(([key, entry]) => [key, entry ?? null]);
  }

  return [];
}

function appendKey(parent: HTMLElement, key: string | null): void {
  if (key === null) {
    return;
  }

  const keyElement = document.createElement('span');
  keyElement.className = 'json-tree__key';
  keyElement.textContent = key;
  parent.append(keyElement);

  const separator = document.createElement('span');
  separator.className = 'json-tree__punctuation';
  separator.textContent = ': ';
  parent.append(separator);
}

function appendPrimitiveValue(parent: HTMLElement, value: PrimitiveValue, previewLength: number): void {
  const valueElement = document.createElement('span');
  valueElement.className = `json-tree__value json-tree__value--${value === null ? 'null' : typeof value}`;

  if (typeof value !== 'string') {
    valueElement.textContent = value === null ? 'null' : String(value);
    parent.append(valueElement);
    return;
  }

  if (value.length <= previewLength) {
    valueElement.textContent = JSON.stringify(value);
    parent.append(valueElement);
    return;
  }

  let expanded = false;
  const update = (): void => {
    valueElement.textContent = JSON.stringify(expanded ? value : `${value.slice(0, previewLength)}…`);
  };
  update();
  parent.append(valueElement);

  const expandButton = document.createElement('button');
  expandButton.type = 'button';
  expandButton.className = 'json-tree__expand-string';
  expandButton.textContent = '…';
  expandButton.title = 'Show full string';
  expandButton.addEventListener('click', (event) => {
    event.stopPropagation();
    expanded = !expanded;
    update();
    expandButton.textContent = expanded ? 'collapse' : '…';
    expandButton.title = expanded ? 'Collapse string' : 'Show full string';
  });
  parent.append(expandButton);
}

function createSummary(key: string | null, value: JsonTreeValue, childCount: number): HTMLElement {
  const summary = document.createElement('summary');
  summary.className = 'json-tree__summary';
  appendKey(summary, key);

  const type = document.createElement('span');
  type.className = 'json-tree__type';
  type.textContent = getTypeName(value);
  summary.append(type);

  if (childCount) {
    const count = document.createElement('span');
    count.className = 'json-tree__count';
    count.textContent = `${String(childCount)} ${childCount === 1 ? 'item' : 'items'}`;
    summary.append(count);
  }

  return summary;
}

function createPrimitiveNode(key: string | null, value: PrimitiveValue, previewLength: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'json-tree__row json-tree__row--primitive';
  appendKey(row, key);
  appendPrimitiveValue(row, value, previewLength);
  return row;
}

function createBranchNode(key: string | null, value: JsonTreeValue, previewLength: number, root = false): HTMLElement {
  const childEntries = getChildEntries(value);
  const details = document.createElement('details');
  details.className = `json-tree__branch${root ? ' json-tree__branch--root' : ''}`;
  details.open = root;

  const children = document.createElement('div');
  children.className = 'json-tree__children';
  let rendered = false;

  const renderChildren = (): void => {
    if (rendered) {
      return;
    }
    rendered = true;

    const eagerEntries = childEntries.slice(0, MAX_EAGER_CHILDREN);
    for (const [childKey, childValue] of eagerEntries) {
      children.append(createJsonTreeNode(childKey, childValue, previewLength));
    }

    if (childEntries.length <= MAX_EAGER_CHILDREN) {
      return;
    }

    const remainingEntries = childEntries.slice(MAX_EAGER_CHILDREN);
    const moreButton = document.createElement('button');
    moreButton.type = 'button';
    moreButton.className = 'json-tree__show-more';
    moreButton.textContent = `Show ${String(remainingEntries.length)} more items`;
    moreButton.addEventListener('click', () => {
      moreButton.remove();
      for (const [childKey, childValue] of remainingEntries) {
        children.append(createJsonTreeNode(childKey, childValue, previewLength));
      }
    });
    children.append(moreButton);
  };

  details.append(createSummary(key, value, childEntries.length), children);
  if (details.open) {
    renderChildren();
  }
  details.addEventListener('toggle', () => {
    if (details.open) {
      renderChildren();
    }
  });

  return details;
}

function createJsonTreeNode(key: string | null, value: JsonTreeValue, previewLength: number): HTMLElement {
  if (value === null || typeof value !== 'object') {
    return createPrimitiveNode(key, value, previewLength);
  }

  return createBranchNode(key, value, previewLength);
}

export function createJsonTreeView(value: JsonTreeValue, options: JsonTreeOptions = {}): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'chat-history-json-tree chat-history-panel';

  const tree = document.createElement('div');
  tree.className = 'json-tree';
  tree.append(createBranchNode(options.rootLabel ?? 'history', value, options.stringPreviewLength ?? DEFAULT_STRING_PREVIEW_LENGTH, true));

  panel.append(tree);
  return panel;
}
