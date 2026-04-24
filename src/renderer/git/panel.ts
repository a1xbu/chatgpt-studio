import { buildGitFileTree, type GitFileTreeNode } from './git-file-tree';
import type { GitBranchRecord, GitCommitDetails, GitCommitRecord, GitRepositoryOverview } from './types';

type GitGraphLane = {
  commitHash: string;
  key: string;
  color: string;
  isActive: boolean;
  isFocused: boolean;
};

type GitGraphChildConnection = {
  laneIndex: number;
  lane: GitGraphLane;
};

type GitGraphRowLayout = {
  nodeLane: number;
  nodeLaneSourceIndex: number | null;
  beforeLanes: GitGraphLane[];
  beforeLaneSourceIndices: number[];
  topChildConnections: GitGraphChildConnection[];
  afterLanes: GitGraphLane[];
  parentConnections: GitGraphChildConnection[];
  maxLaneCount: number;
  nodeLaneSeeded: boolean;
  hasVisibleParents: boolean;
  nodeColor: string;
  nodeIsActive: boolean;
  nodeIsFocused: boolean;
  nodeIsTerminalHead: boolean;
};

type GitGraphContext = {
  activeBranchName: string | null;
  focusedBranchName: string | null;
  branchColorByName: Map<string, string>;
  branchNamesByCommitHash: Map<string, string[]>;
  branchNames: Set<string>;
  commitLaneMetaByHash: Map<string, { key: string; color: string; isActive: boolean; isFocused: boolean; priority: number }>;
  getGenericColor: (key: string) => string;
};

export type GitPanelViewModel = {
  activeProjectName: string;
  hasProject: boolean;
  isLoading: boolean;
  loadError: string | null;
  overview: GitRepositoryOverview | null;
  selectedBranchName: string | null;
  selectedCommitHash: string | null;
  commitDetails: GitCommitDetails | null;
  commitDetailsIsLoading: boolean;
  commitDetailsError: string | null;
};

export type GitPanelRenderHelpers = {
  escapeHtml: (value: string | null | undefined) => string;
  formatTimestamp: (value: string | null | undefined) => string;
  renderGitFileTreeNodes: (commitHash: string, nodes: GitFileTreeNode[]) => string;
  renderRefreshIcon: () => string;
};

const GIT_GRAPH_PRIMARY_COLOR = '#57d38c';
const GIT_GRAPH_SECONDARY_COLOR = '#f2c94c';
const GIT_GRAPH_TERTIARY_COLOR = '#ff7a59';
const GIT_GRAPH_OTHER_COLORS = ['#b37dff', '#44d1d9', '#ff5d8f', '#ef6c6c', '#4c89ff'];
const GIT_GRAPH_COLORS = [GIT_GRAPH_PRIMARY_COLOR, GIT_GRAPH_SECONDARY_COLOR, GIT_GRAPH_TERTIARY_COLOR, ...GIT_GRAPH_OTHER_COLORS];
const GIT_GRAPH_LANE_GAP_PX = 10;
const GIT_GRAPH_LEFT_PADDING_PX = 8;
const GIT_GRAPH_HEIGHT_PX = 24;
const GIT_GRAPH_CENTER_Y_PX = 12;

const GIT_TRUNK_BRANCH_RANKS = new Map<string, number>([
  ['main', 0],
  ['master', 1],
  ['develop', 2],
  ['dev', 3],
  ['trunk', 4],
]);

function getGitTrunkBranchRank(name: string): number {
  return GIT_TRUNK_BRANCH_RANKS.get(name.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
}

function formatGitPanelDateLabel(value: string | null | undefined): string {
  if (!value) {
    return 'n/a';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const nextDayStart = new Date(todayStart);
  nextDayStart.setDate(todayStart.getDate() + 1);

  const timeLabel = parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (parsed >= todayStart && parsed < nextDayStart) {
    return `Today ${timeLabel}`;
  }
  if (parsed >= yesterdayStart && parsed < todayStart) {
    return `Yesterday ${timeLabel}`;
  }

  return `${parsed.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })} ${timeLabel}`;
}

function getGitRefLabels(commit: GitCommitRecord): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const rawRef of commit.refs) {
    const normalized = rawRef.replace(/^HEAD\s*->\s*/i, 'HEAD ').trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    labels.push(normalized);
  }
  return labels;
}

function createGitGraphContext(
  overview: GitRepositoryOverview,
  selectedBranchName: string | null,
): GitGraphContext {
  const activeBranchName = overview.currentBranch?.name ?? null;
  const focusedBranchName = selectedBranchName ?? overview.selectedRefName ?? activeBranchName;
  const commitOrderByHash = new Map(overview.commits.map((commit, index) => [commit.hash, index]));
  const prioritizedBranches = [...overview.branches].sort((left, right) => {
    const leftTrunkRank = getGitTrunkBranchRank(left.name);
    const rightTrunkRank = getGitTrunkBranchRank(right.name);
    if (leftTrunkRank !== rightTrunkRank) {
      return leftTrunkRank - rightTrunkRank;
    }

    const leftHeadOrder = left.commitHash ? commitOrderByHash.get(left.commitHash) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const rightHeadOrder = right.commitHash ? commitOrderByHash.get(right.commitHash) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    if (leftHeadOrder !== rightHeadOrder) {
      return leftHeadOrder - rightHeadOrder;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  });

  const branchColorByName = new Map<string, string>();
  prioritizedBranches.forEach((branch, index) => {
    branchColorByName.set(branch.name, GIT_GRAPH_COLORS[index % GIT_GRAPH_COLORS.length] ?? GIT_GRAPH_PRIMARY_COLOR);
  });

  const branchNamesByCommitHash = new Map<string, string[]>();
  for (const branch of prioritizedBranches) {
    if (!branch.commitHash) {
      continue;
    }
    const existing = branchNamesByCommitHash.get(branch.commitHash) ?? [];
    existing.push(branch.name);
    branchNamesByCommitHash.set(branch.commitHash, existing);
  }

  const commitByHash = new Map(overview.commits.map((commit) => [commit.hash, commit]));
  const commitLaneMetaByHash = new Map<string, { key: string; color: string; isActive: boolean; isFocused: boolean; priority: number }>();
  prioritizedBranches.forEach((branch, priority) => {
    if (!branch.commitHash) {
      return;
    }

    const branchColor = branchColorByName.get(branch.name) ?? GIT_GRAPH_PRIMARY_COLOR;
    const visited = new Set<string>();
    let nextCommitHash: string | null = branch.commitHash;
    while (nextCommitHash && !visited.has(nextCommitHash)) {
      visited.add(nextCommitHash);
      const commit = commitByHash.get(nextCommitHash);
      if (!commit) {
        break;
      }

      const existing = commitLaneMetaByHash.get(commit.hash);
      if (existing && existing.priority <= priority) {
        break;
      }

      commitLaneMetaByHash.set(commit.hash, {
        key: `branch:${branch.name}`,
        color: branchColor,
        isActive: branch.name === activeBranchName,
        isFocused: branch.name === focusedBranchName,
        priority,
      });

      nextCommitHash = commit.parentHashes[0] ?? null;
    }
  });

  const genericColorByKey = new Map<string, string>();
  const getGenericColor = (key: string): string => {
    const existing = genericColorByKey.get(key);
    if (existing) {
      return existing;
    }
    const color = GIT_GRAPH_COLORS[(branchColorByName.size + genericColorByKey.size) % GIT_GRAPH_COLORS.length] ?? GIT_GRAPH_PRIMARY_COLOR;
    genericColorByKey.set(key, color);
    return color;
  };

  return {
    activeBranchName,
    focusedBranchName,
    branchColorByName,
    branchNamesByCommitHash,
    branchNames: new Set(overview.branches.map((branch) => branch.name)),
    commitLaneMetaByHash,
    getGenericColor,
  };
}

function createLaneForCommit(commitHash: string, fallbackKey: string, context: GitGraphContext): GitGraphLane {
  const seededMeta = context.commitLaneMetaByHash.get(commitHash);
  if (seededMeta) {
    return {
      commitHash,
      key: seededMeta.key,
      color: seededMeta.color,
      isActive: seededMeta.isActive,
      isFocused: seededMeta.isFocused,
    };
  }

  const branchNames = context.branchNamesByCommitHash.get(commitHash) ?? [];
  const isActive = context.activeBranchName ? branchNames.includes(context.activeBranchName) : false;
  const isFocused = context.focusedBranchName ? branchNames.includes(context.focusedBranchName) : false;
  const primaryBranchName = branchNames[0] ?? null;
  return {
    commitHash,
    key: primaryBranchName ? `branch:${primaryBranchName}` : fallbackKey,
    color: primaryBranchName ? context.branchColorByName.get(primaryBranchName) ?? context.getGenericColor(fallbackKey) : context.getGenericColor(fallbackKey),
    isActive,
    isFocused,
  };
}

function resolveRefBranchName(label: string, context: GitGraphContext): string | null {
  const directLabel = label.trim();
  if (context.branchNames.has(directLabel)) {
    return directLabel;
  }

  const headMatch = directLabel.match(/^HEAD\s+(.+)$/i);
  if (headMatch && context.branchNames.has(headMatch[1] ?? '')) {
    return headMatch[1] ?? null;
  }

  return null;
}

function findLaneIndexByKeyOrHash(lanes: GitGraphLane[], laneKey: string, commitHash: string): number {
  const keyMatchIndex = lanes.findIndex((lane) => lane.key === laneKey);
  if (keyMatchIndex >= 0) {
    return keyMatchIndex;
  }

  return lanes.findIndex((lane) => lane.commitHash === commitHash);
}

function renderGitStatusPill(
  label: string,
  value: number,
  escapeHtml: GitPanelRenderHelpers['escapeHtml'],
  tone: 'neutral' | 'warn' | 'error' = 'neutral',
): string {
  const toneClass = tone === 'error' ? ' git-pill--error' : tone === 'warn' ? ' git-pill--warn' : '';
  return `<span class="git-pill${toneClass}">${escapeHtml(label)}: <strong>${String(value)}</strong></span>`;
}

function renderGitBranchRows(
  overview: GitRepositoryOverview,
  selectedBranchName: string | null,
  helpers: Pick<GitPanelRenderHelpers, 'escapeHtml'>,
  context: GitGraphContext,
): string {
  if (!overview.branches.length) {
    return '<div class="git-panel__empty">No local branches found.</div>';
  }

  const currentBranches = overview.branches.filter((branch) => branch.isCurrent);
  const localBranches = overview.branches.filter((branch) => !branch.isCurrent);
  const renderBranchButton = (branch: GitBranchRecord): string => {
    const isSelected = (selectedBranchName ?? overview.selectedRefName) === branch.name;
    const isActive = branch.name === context.activeBranchName;
    const branchColor = context.branchColorByName.get(branch.name) ?? context.getGenericColor(`branch:${branch.name}`);
    const trackingMarkup = branch.upstream
      ? `<span class="git-branch-row__upstream">${helpers.escapeHtml(branch.upstream)}</span>`
      : '<span class="git-branch-row__upstream git-branch-row__upstream--muted">No upstream</span>';
    const aheadBehindMarkup = branch.aheadBy || branch.behindBy
      ? `<span class="git-branch-row__track">${branch.aheadBy ? `↑${String(branch.aheadBy)}` : ''}${branch.aheadBy && branch.behindBy ? ' ' : ''}${branch.behindBy ? `↓${String(branch.behindBy)}` : ''}</span>`
      : '';

    return `
      <button
        class="git-branch-row${isSelected ? ' git-branch-row--selected' : ''}${isActive ? ' git-branch-row--active' : ''}"
        data-action="select-git-branch"
        data-branch-name="${helpers.escapeHtml(branch.name)}"
        type="button"
        title="${helpers.escapeHtml(branch.name)}"
        style="--git-branch-color:${helpers.escapeHtml(branchColor)};"
      >
        <span class="git-branch-row__header">
          <span class="git-branch-row__swatch" aria-hidden="true"></span>
          <span class="git-branch-row__name">${helpers.escapeHtml(branch.name)}</span>
          ${branch.isCurrent ? '<span class="git-branch-row__current">HEAD</span>' : ''}
        </span>
        <span class="git-branch-row__meta">
          ${trackingMarkup}
          ${aheadBehindMarkup}
        </span>
      </button>
    `;
  };

  const sections: string[] = [];
  if (currentBranches.length) {
    sections.push(`
      <div class="git-branch-group">
        <div class="git-branch-group__title">HEAD (Current Branch)</div>
        ${currentBranches.map(renderBranchButton).join('')}
      </div>
    `);
  }
  if (localBranches.length) {
    sections.push(`
      <div class="git-branch-group">
        <div class="git-branch-group__title">Local</div>
        ${localBranches.map(renderBranchButton).join('')}
      </div>
    `);
  }

  return sections.join('');
}

function buildGitGraphLayouts(
  commits: GitCommitRecord[],
  context: GitGraphContext,
): Map<string, GitGraphRowLayout> {
  const visibleHashes = new Set(commits.map((commit) => commit.hash));
  const layouts = new Map<string, GitGraphRowLayout>();
  const pendingTopConnectionsByCommitHash = new Map<string, Array<{
    commitHash: string;
    laneKey: string;
    fallbackLaneIndex: number;
    color: string;
    isActive: boolean;
    isFocused: boolean;
  }>>();

  let lanes: GitGraphLane[] = [];
  let previousAfterLanes: GitGraphLane[] = [];
  let maxLaneCount = 1;
  for (const commit of commits) {
    const visibleParents = commit.parentHashes.filter((hash) => visibleHashes.has(hash));
    const primaryParentHash = visibleParents[0] ?? null;
    const preferredNodeLane = createLaneForCommit(commit.hash, `seed:${commit.hash}`, context);
    let laneIndex = lanes.findIndex((lane) => lane.commitHash === commit.hash && lane.key === preferredNodeLane.key);
    if (laneIndex < 0) {
      laneIndex = lanes.findIndex((lane) => lane.commitHash === commit.hash);
    }
    const nodeLaneSeeded = laneIndex < 0;
    let nodeLaneSourceIndex: number | null = null;
    if (laneIndex < 0) {
      const primaryParentLaneIndex = primaryParentHash ? lanes.findIndex((lane) => lane.commitHash === primaryParentHash) : -1;
      const seedLane = preferredNodeLane;
      if (primaryParentLaneIndex >= 0) {
        const insertionIndex = Math.min(primaryParentLaneIndex + 1, lanes.length);
        lanes = [
          ...lanes.slice(0, insertionIndex),
          seedLane,
          ...lanes.slice(insertionIndex),
        ];
        laneIndex = insertionIndex;
        nodeLaneSourceIndex = primaryParentLaneIndex;
      } else {
        lanes = [seedLane, ...lanes];
        laneIndex = 0;
      }
    }

    const beforeLanes = lanes.map((lane) => ({ ...lane }));
    const beforeLaneSourceIndices = beforeLanes.map((lane, index) => {
      const previousLaneIndex = findLaneIndexByKeyOrHash(previousAfterLanes, lane.key, lane.commitHash);
      return previousLaneIndex >= 0 ? previousLaneIndex : index;
    });
    const currentLane = beforeLanes[laneIndex] ?? preferredNodeLane;

    const rawTopChildConnections = pendingTopConnectionsByCommitHash.get(commit.hash) ?? [];
    const usedTopChildConnectionKeys = new Set<string>();
    const topChildConnections: GitGraphChildConnection[] = rawTopChildConnections.flatMap((connection) => {
      const resolvedLaneIndex = findLaneIndexByKeyOrHash(beforeLanes, connection.laneKey, connection.commitHash);
      const laneIndexForConnection = resolvedLaneIndex >= 0 ? resolvedLaneIndex : connection.fallbackLaneIndex;
      const dedupeKey = `${connection.commitHash}:${String(laneIndexForConnection)}`;
      if (usedTopChildConnectionKeys.has(dedupeKey)) {
        return [];
      }
      usedTopChildConnectionKeys.add(dedupeKey);
      return [{
        laneIndex: laneIndexForConnection,
        lane: {
          commitHash: connection.commitHash,
          key: connection.laneKey,
          color: connection.color,
          isActive: connection.isActive,
          isFocused: connection.isFocused,
        },
      }];
    });

    const parentConnections: GitGraphChildConnection[] = [];
    const nextLanes = beforeLanes
      .map((lane, index) => (index === laneIndex || lane.commitHash === commit.hash ? null : { ...lane }))
      .filter((lane): lane is GitGraphLane => Boolean(lane));

    visibleParents.forEach((parentHash, parentIndex) => {
      if (parentIndex === 0) {
        const parentLane = { ...currentLane, commitHash: parentHash };
        nextLanes.splice(laneIndex, 0, parentLane);
        return;
      }

      const existingLaneIndex = nextLanes.findIndex((lane) => lane.commitHash === parentHash);
      if (existingLaneIndex >= 0) {
        const connectionLane = nextLanes[existingLaneIndex] ?? createLaneForCommit(parentHash, `merge:${commit.hash}:${parentHash}`, context);
        parentConnections.push({
          laneIndex: existingLaneIndex,
          lane: { ...connectionLane },
        });
        return;
      }

      const parentLane = createLaneForCommit(parentHash, `merge:${commit.hash}:${parentHash}`, context);
      const insertionIndex = Math.min(laneIndex + parentIndex, nextLanes.length);
      nextLanes.splice(insertionIndex, 0, parentLane);
      parentConnections.push({
        laneIndex: insertionIndex,
        lane: { ...parentLane },
      });
    });

    if (primaryParentHash) {
      const primaryParentLane = createLaneForCommit(primaryParentHash, `parent:${commit.hash}:${primaryParentHash}`, context);
      if (primaryParentLane.key !== currentLane.key || nodeLaneSourceIndex !== null) {
        const existingConnections = pendingTopConnectionsByCommitHash.get(primaryParentHash) ?? [];
        existingConnections.push({
          commitHash: commit.hash,
          laneKey: currentLane.key,
          fallbackLaneIndex: laneIndex,
          color: currentLane.color,
          isActive: currentLane.isActive,
          isFocused: currentLane.isFocused,
        });
        pendingTopConnectionsByCommitHash.set(primaryParentHash, existingConnections);
      }
    }

    const afterLanes = nextLanes.map((lane) => ({ ...lane }));
    const topConnectionMaxLaneIndex = topChildConnections.reduce((maxIndex, connection) => Math.max(maxIndex, connection.laneIndex), -1);
    maxLaneCount = Math.max(maxLaneCount, beforeLanes.length, afterLanes.length, laneIndex + 1, topConnectionMaxLaneIndex + 1);
    layouts.set(commit.hash, {
      nodeLane: laneIndex,
      nodeLaneSourceIndex,
      beforeLanes,
      beforeLaneSourceIndices,
      topChildConnections,
      afterLanes,
      parentConnections,
      maxLaneCount,
      nodeLaneSeeded,
      hasVisibleParents: visibleParents.length > 0,
      nodeColor: currentLane.color,
      nodeIsActive: currentLane.isActive,
      nodeIsFocused: currentLane.isFocused,
      nodeIsTerminalHead: nodeLaneSeeded && nodeLaneSourceIndex === null,
    });
    lanes = afterLanes;
    previousAfterLanes = afterLanes.map((lane) => ({ ...lane }));
  }

  layouts.forEach((layout) => {
    layout.maxLaneCount = maxLaneCount;
  });
  return layouts;
}

function getGitGraphWidth(layout: GitGraphRowLayout | undefined): number {
  if (!layout) {
    return 40;
  }

  return Math.max(40, GIT_GRAPH_LEFT_PADDING_PX * 2 + Math.max(layout.maxLaneCount - 1, 0) * GIT_GRAPH_LANE_GAP_PX);
}

function renderGitGraphSvg(layout: GitGraphRowLayout | undefined): string {
  const width = getGitGraphWidth(layout);
  if (!layout) {
    return '<span class="git-commit-row__graph" aria-hidden="true"></span>';
  }

  const xForLane = (index: number) => GIT_GRAPH_LEFT_PADDING_PX + index * GIT_GRAPH_LANE_GAP_PX;
  const lineMarkup = (lane: GitGraphLane, coordinates: { x1: number; y1: number; x2: number; y2: number }): string => {
    const strokeWidth = lane.isActive ? 2.5 : lane.isFocused ? 2.15 : 1.8;
    const opacity = lane.isActive ? 1 : lane.isFocused ? 0.98 : 0.9;
    const classes = ['git-commit-row__graph-line'];
    if (lane.isActive) {
      classes.push('git-commit-row__graph-line--active');
    } else if (lane.isFocused) {
      classes.push('git-commit-row__graph-line--focused');
    }
    return `<line class="${classes.join(' ')}" x1="${coordinates.x1}" y1="${coordinates.y1}" x2="${coordinates.x2}" y2="${coordinates.y2}" stroke="${lane.color}" stroke-opacity="${String(opacity)}" stroke-width="${String(strokeWidth)}" stroke-linecap="round" />`;
  };
  const segments: string[] = [];
  const topChildLaneIndices = new Set(layout.topChildConnections.map((connection) => connection.laneIndex));

  layout.beforeLanes.forEach((lane, index) => {
    if (topChildLaneIndices.has(index)) {
      return;
    }
    const sourceLaneIndex = index === layout.nodeLane && layout.nodeLaneSourceIndex !== null
      ? index
      : layout.beforeLaneSourceIndices[index] ?? index;
    if (layout.nodeIsTerminalHead && index === layout.nodeLane && sourceLaneIndex === index) {
      return;
    }
    segments.push(lineMarkup(lane, {
      x1: xForLane(sourceLaneIndex),
      y1: 0,
      x2: xForLane(index),
      y2: GIT_GRAPH_CENTER_Y_PX,
    }));
  });

  const nodeX = xForLane(layout.nodeLane);
  layout.topChildConnections.forEach((connection) => {
    if (connection.laneIndex === layout.nodeLane) {
      return;
    }
    segments.push(lineMarkup(connection.lane, {
      x1: nodeX,
      y1: GIT_GRAPH_CENTER_Y_PX,
      x2: xForLane(connection.laneIndex),
      y2: 0,
    }));
  });

  layout.afterLanes.forEach((lane, index) => {
    segments.push(lineMarkup(lane, { x1: xForLane(index), y1: GIT_GRAPH_CENTER_Y_PX, x2: xForLane(index), y2: GIT_GRAPH_HEIGHT_PX }));
  });

  layout.parentConnections.forEach((connection) => {
    if (connection.laneIndex === layout.nodeLane) {
      return;
    }
    segments.push(lineMarkup(connection.lane, {
      x1: nodeX,
      y1: GIT_GRAPH_CENTER_Y_PX,
      x2: xForLane(connection.laneIndex),
      y2: GIT_GRAPH_HEIGHT_PX,
    }));
  });

  const nodeRadius = layout.nodeIsTerminalHead ? 5 : layout.nodeIsActive ? 4.25 : 3.6;
  const nodeStrokeWidth = layout.nodeIsTerminalHead ? 1.8 : layout.nodeIsActive ? 1.55 : 1.35;
  const nodeClasses = ['git-commit-row__graph-node'];
  if (layout.nodeIsTerminalHead) {
    nodeClasses.push('git-commit-row__graph-node--terminal');
  }
  if (layout.nodeIsActive) {
    nodeClasses.push('git-commit-row__graph-node--active');
  } else if (layout.nodeIsFocused) {
    nodeClasses.push('git-commit-row__graph-node--focused');
  }
  segments.push(`<circle class="${nodeClasses.join(' ')}" cx="${nodeX}" cy="${GIT_GRAPH_CENTER_Y_PX}" r="${String(nodeRadius)}" fill="${layout.nodeColor}" stroke="#0f1215" stroke-width="${String(nodeStrokeWidth)}" />`);

  return `
    <span class="git-commit-row__graph" aria-hidden="true">
      <svg viewBox="0 0 ${width} ${GIT_GRAPH_HEIGHT_PX}" preserveAspectRatio="xMinYMid meet">
        ${segments.join('')}
      </svg>
    </span>
  `;
}

function renderGitRefBadges(
  refLabels: string[],
  helpers: Pick<GitPanelRenderHelpers, 'escapeHtml'>,
  context: GitGraphContext,
): string {
  if (!refLabels.length) {
    return '<span class="git-commit-row__refs git-commit-row__refs--empty"></span>';
  }

  return `<span class="git-commit-row__refs">${refLabels
    .map((ref) => {
      const branchName = resolveRefBranchName(ref, context);
      const isActive = branchName === context.activeBranchName;
      const isFocused = branchName === context.focusedBranchName;
      const color = branchName ? context.branchColorByName.get(branchName) ?? context.getGenericColor(`branch:${branchName}`) : null;
      const classes = ['git-ref-badge'];
      if (branchName) {
        classes.push('git-ref-badge--branch');
      }
      if (isActive) {
        classes.push('git-ref-badge--active');
      } else if (isFocused) {
        classes.push('git-ref-badge--focused');
      }
      const styleAttribute = color ? ` style="--git-branch-color:${helpers.escapeHtml(color)};"` : '';
      return `<span class="${classes.join(' ')}"${styleAttribute}>${helpers.escapeHtml(ref)}</span>`;
    })
    .join('')}</span>`;
}

export function getGitStatusLabel(status: string | null | undefined): string {
  const normalized = (status ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'A':
      return 'Added';
    case 'D':
      return 'Deleted';
    case 'R':
      return 'Renamed';
    case 'C':
      return 'Copied';
    case 'M':
      return 'Modified';
    default:
      return normalized || '';
  }
}

function renderGitCommitFilesPanel(
  selectedCommit: GitCommitRecord | null,
  commitDetails: GitCommitDetails | null,
  commitDetailsIsLoading: boolean,
  commitDetailsError: string | null,
  selectedCommitHash: string | null,
  helpers: Pick<GitPanelRenderHelpers, 'escapeHtml' | 'renderGitFileTreeNodes'>,
): string {
  if (!selectedCommit) {
    return '<div class="git-panel__empty">Select a commit to inspect its changed files.</div>';
  }

  if (commitDetailsIsLoading && selectedCommitHash === selectedCommit.hash) {
    return `<div class="git-panel__empty">Loading changed files for ${helpers.escapeHtml(selectedCommit.shortHash)}…</div>`;
  }

  if (commitDetailsError) {
    return `<div class="git-panel__empty git-panel__empty--error">${helpers.escapeHtml(commitDetailsError)}</div>`;
  }

  const details = commitDetails && commitDetails.commitHash === selectedCommit.hash ? commitDetails : null;
  if (!details?.files.length) {
    return '<div class="git-panel__empty">No file changes were reported for this commit.</div>';
  }

  const tree = buildGitFileTree(details.files);
  return `
    <div class="git-file-tree">
      ${helpers.renderGitFileTreeNodes(selectedCommit.hash, tree)}
    </div>
  `;
}

function renderGitCommitRows(
  overview: GitRepositoryOverview,
  selectedBranchName: string | null,
  selectedCommitHash: string | null,
  helpers: Pick<GitPanelRenderHelpers, 'escapeHtml'>,
  context: GitGraphContext,
): string {
  if (!overview.commits.length) {
    return '<div class="git-panel__empty">No commits found for local branches.</div>';
  }

  const graphLayouts = buildGitGraphLayouts(overview.commits, context);
  return overview.commits
    .map((commit) => {
      const isSelected = selectedCommitHash === commit.hash;
      const refLabels = getGitRefLabels(commit);
      const graphLayout = graphLayouts.get(commit.hash);
      const refsMarkup = renderGitRefBadges(refLabels, helpers, context);
      const rowClasses = ['git-commit-row'];
      if (isSelected) {
        rowClasses.push('git-commit-row--selected');
      }
      const graphWidth = getGitGraphWidth(graphLayout);

      return `
        <button
          class="${rowClasses.join(' ')}"
          data-action="select-git-commit"
          data-commit-hash="${helpers.escapeHtml(commit.hash)}"
          type="button"
          title="${helpers.escapeHtml(commit.subject)}"
          style="--git-graph-width:${String(graphWidth)}px;"
        >
          ${renderGitGraphSvg(graphLayout)}
          <span class="git-commit-row__subject">${helpers.escapeHtml(commit.subject)}</span>
          ${refsMarkup}
          <span class="git-commit-row__author">${helpers.escapeHtml(commit.authorName)}</span>
          <span class="git-commit-row__date">${helpers.escapeHtml(formatGitPanelDateLabel(commit.authoredAt))}</span>
        </button>
      `;
    })
    .join('');
}

export function renderGitPanelMarkup(
  viewModel: GitPanelViewModel,
  helpers: GitPanelRenderHelpers,
): string {
  if (!viewModel.hasProject) {
    return `
      <div class="git-panel">
        <div class="git-panel__empty-shell">
          Select a project with a Git repository to open the Git tool window.
        </div>
      </div>
    `;
  }

  if (viewModel.isLoading && !viewModel.overview && !viewModel.loadError) {
    return `
      <div class="git-panel">
        <div class="git-panel__empty-shell">Loading Git data for ${helpers.escapeHtml(viewModel.activeProjectName)}…</div>
      </div>
    `;
  }

  if (viewModel.loadError && !viewModel.overview) {
    return `
      <div class="git-panel">
        <div class="git-panel__toolbar">
          <div class="git-panel__summary">
            <span class="git-panel__title">Git</span>
            <span class="git-panel__subtitle">${helpers.escapeHtml(viewModel.activeProjectName)}</span>
          </div>
          <button class="icon-button" data-action="refresh-git-panel" type="button" title="Refresh Git view" aria-label="Refresh Git view">
            ${helpers.renderRefreshIcon()}
          </button>
        </div>
        <div class="git-panel__empty-shell git-panel__empty-shell--error">${helpers.escapeHtml(viewModel.loadError)}</div>
      </div>
    `;
  }

  if (!viewModel.overview) {
    return `
      <div class="git-panel">
        <div class="git-panel__empty-shell">Git is not available for the selected project.</div>
      </div>
    `;
  }

  const { currentBranch, statusSummary, repoRootPath, selectedRefName } = viewModel.overview;
  const graphContext = createGitGraphContext(viewModel.overview, viewModel.selectedBranchName);
  const selectedCommit = viewModel.overview.commits.find((commit) => commit.hash === viewModel.selectedCommitHash)
    ?? viewModel.overview.commits[0]
    ?? null;
  const selectedCommitFileCount = viewModel.commitDetails?.commitHash === selectedCommit?.hash ? viewModel.commitDetails.files.length : 0;
  const commitsSummaryLabel = selectedRefName
    ? `All local branches · focus ${selectedRefName}`
    : 'All local branches';
  return `
    <div class="git-panel">
      <div class="git-panel__toolbar">
        <div class="git-panel__summary">
          <span class="git-panel__title">${helpers.escapeHtml(currentBranch?.name ?? selectedRefName)}</span>
          <span class="git-panel__subtitle">${helpers.escapeHtml(repoRootPath)}</span>
        </div>
        <div class="git-panel__toolbar-actions">
          ${renderGitStatusPill('Staged', statusSummary.staged, helpers.escapeHtml)}
          ${renderGitStatusPill('Changed', statusSummary.unstaged, helpers.escapeHtml, statusSummary.unstaged ? 'warn' : 'neutral')}
          ${renderGitStatusPill('Untracked', statusSummary.untracked, helpers.escapeHtml)}
          ${statusSummary.conflicted ? renderGitStatusPill('Conflicts', statusSummary.conflicted, helpers.escapeHtml, 'error') : ''}
          <button class="icon-button" data-action="refresh-git-panel" type="button" title="Refresh Git view" aria-label="Refresh Git view">
            ${helpers.renderRefreshIcon()}
          </button>
        </div>
      </div>
      <div class="git-panel__content">
        <section class="git-panel__section git-panel__section--branches">
          <header class="git-panel__section-header">
            <span>Branches</span>
            <span class="git-panel__section-count">${String(viewModel.overview.branches.length)}</span>
          </header>
          <div class="git-panel__scroll" data-git-scroll="branches">${renderGitBranchRows(viewModel.overview, viewModel.selectedBranchName, helpers, graphContext)}</div>
        </section>
        <section class="git-panel__section git-panel__section--commits">
          <header class="git-panel__section-header">
            <span>Commits</span>
            <span class="git-panel__section-count">${helpers.escapeHtml(commitsSummaryLabel)}</span>
          </header>
          <div class="git-panel__scroll git-panel__scroll--commits" data-git-scroll="commits">${renderGitCommitRows(viewModel.overview, viewModel.selectedBranchName, viewModel.selectedCommitHash, helpers, graphContext)}</div>
        </section>
        <section class="git-panel__section git-panel__section--files">
          <header class="git-panel__section-header">
            <span>Files</span>
            <span class="git-panel__section-count">${selectedCommit ? `${helpers.escapeHtml(selectedCommit.shortHash)} · ${String(selectedCommitFileCount)}` : '—'}</span>
          </header>
          <div class="git-panel__selection-summary">
            ${selectedCommit ? `<span class="git-panel__selection-title">${helpers.escapeHtml(selectedCommit.subject)}</span><span class="git-panel__selection-meta">${helpers.escapeHtml(selectedCommit.authorName)} · ${helpers.escapeHtml(helpers.formatTimestamp(selectedCommit.authoredAt))}</span>` : ''}
          </div>
          <div class="git-panel__scroll" data-git-scroll="files">${renderGitCommitFilesPanel(selectedCommit, viewModel.commitDetails, viewModel.commitDetailsIsLoading, viewModel.commitDetailsError, viewModel.selectedCommitHash, helpers)}</div>
        </section>
      </div>
    </div>
  `;
}
