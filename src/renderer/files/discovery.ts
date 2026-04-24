import type { ChatFileRecord } from '../../shared/contracts';

export type FileDiscoveryChatFileRecord = Pick<
  ChatFileRecord,
  'projectId' | 'projectName' | 'chatId' | 'messageId' | 'sandboxPath' | 'downloadUrl' | 'downloadPath' | 'fileName' | 'discoveredAt' | 'updatedAt'
>;

export type FileDiscoveryProjectRecord<TFile extends FileDiscoveryChatFileRecord = FileDiscoveryChatFileRecord> = {
  files: TFile[];
};

export type FileDiscoverySidebarSelection =
  | {
      kind: 'project';
      projectId: string;
    }
  | {
      kind: 'chat';
      projectId: string;
      chatId: string;
    };

export function getChatFileKey(file: Pick<FileDiscoveryChatFileRecord, 'chatId' | 'messageId' | 'sandboxPath'>): string {
  return `${file.chatId}::${file.messageId}::${file.sandboxPath}`;
}

export function getSandboxFileBaseName(file: Pick<FileDiscoveryChatFileRecord, 'sandboxPath' | 'fileName'>): string {
  const explicitName = (file.fileName ?? '').trim();
  if (explicitName) {
    return explicitName;
  }

  const segments = file.sandboxPath.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? file.sandboxPath;
}

export function getAllSidebarFiles<TProject extends FileDiscoveryProjectRecord<TFile>, TFile extends FileDiscoveryChatFileRecord>(
  projects: TProject[],
): Array<{ project: TProject; file: TFile }> {
  return projects.flatMap((project) => project.files.map((file) => ({ project, file } as { project: TProject; file: TFile })));
}

export function getMostRecentMessageFiles<TProject extends FileDiscoveryProjectRecord<TFile>, TFile extends FileDiscoveryChatFileRecord>(
  entries: Array<{ project: TProject; file: TFile }>,
): Array<{ project: TProject; file: TFile }> {
  if (!entries.length) {
    return [];
  }

  const sortedEntries = [...entries].sort((left, right) => {
    const rightTime = Date.parse(right.file.updatedAt || right.file.discoveredAt || '') || 0;
    const leftTime = Date.parse(left.file.updatedAt || left.file.discoveredAt || '') || 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return getChatFileKey(left.file).localeCompare(getChatFileKey(right.file));
  });

  const latestEntry = sortedEntries[0];
  if (!latestEntry) {
    return [];
  }

  return sortedEntries.filter(
    ({ file }) =>
      file.projectId === latestEntry.file.projectId &&
      file.chatId === latestEntry.file.chatId &&
      file.messageId === latestEntry.file.messageId,
  );
}

export function getLatestNewFiles<TProject extends FileDiscoveryProjectRecord<TFile>, TFile extends FileDiscoveryChatFileRecord>(
  projects: TProject[],
  selection: FileDiscoverySidebarSelection | null,
): Array<{ project: TProject; file: TFile }> {
  const entries: Array<{ project: TProject; file: TFile }> = getAllSidebarFiles(projects);
  if (!entries.length || !selection?.projectId) {
    return [];
  }

  const projectEntries: Array<{ project: TProject; file: TFile }> = entries.filter(({ file }) => file.projectId === selection.projectId);
  if (!projectEntries.length) {
    return [];
  }

  if (selection.kind === 'chat') {
    const chatEntries: Array<{ project: TProject; file: TFile }> = projectEntries.filter(({ file }) => file.chatId === selection.chatId);
    return getMostRecentMessageFiles(chatEntries);
  }

  return getMostRecentMessageFiles(projectEntries);
}
