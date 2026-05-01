import { BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { JsonAppStore } from './app-store';
import {
  deleteChatArtifacts,
  ensureProjectMetaDb,
  getChatFile,
  getChatHistory as getPersistedChatHistory,
  getChatMessageThoughts,
  getProjectBundle,
  listChatFileArchiveEntries,
  listProjectChats,
  listProjectFiles,
  replaceChatFileArchiveEntries,
  resolveProjectMetaDbPath,
  upsertProjectBundle,
  upsertChatFile,
  upsertChatHistory,
  upsertProjectChat,
} from './project-meta-db';
import { createProjectBundle } from './project-bundle';
import { applyDownloadedSandboxFile, compareArchiveEntriesAgainstProject, inspectDownloadedArchive, isDownloadedZipFile } from './project-archive';
import { inspectDownloadedGitBundle, isDownloadedGitBundleFile } from './git-bundle';
import {
  AppStateSnapshot,
  ApplySandboxFileResult,
  ChatFileArchiveEntryRecord,
  ChatFileRecord,
  ChatHistoryMessageRecord,
  ChatHistoryRecord,
  ChatPageContext,
  ProjectBinding,
  ProjectBundleRecord,
  ProjectChatRecord,
  SidebarProject,
} from '../shared/contracts';

interface TemporaryProjectState {
  projectId: string;
  projectName: string;
  projectUrl: string | null;
  chats: Map<string, ProjectChatRecord>;
  chatHistories: Map<string, ChatHistoryRecord>;
  files: Map<string, ChatFileRecord>;
  lastSeenAt: string;
}

function cleanupText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeMessageText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = cleanupText(value);
  return normalized || null;
}

function ensureTimestamp(value: unknown): string {
  const normalized = cleanupText(value);
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function ensureNullableTimestamp(value: unknown): string | null {
  const normalized = cleanupText(value);
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function buildHistorySearchText(messages: readonly ChatHistoryMessageRecord[]): string {
  return messages
    .map((message) =>
      [
        message.role,
        message.text,
        message.reasoning?.recap ?? '',
        ...(message.reasoning?.steps.flatMap((step) => [step.summary ?? '', step.content, ...step.chunks]) ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join('\n')
    .toLowerCase();
}

function resolveProjectName(projectId: string, candidate: string | null): string {
  return candidate ?? 'Loading project...';
}

function resolveChatName(chatId: string, candidate: string | null): string {
  return candidate ?? 'Loading chat...';
}

function normalizeComparablePath(folderPath: string): string {
  return path.resolve(folderPath).replace(/\\/g, '/').toLowerCase();
}

function sortChats(chats: Iterable<ProjectChatRecord>): ProjectChatRecord[] {
  return Array.from(chats).sort((left, right) => {
    const rightTime = Date.parse(right.updatedAt);
    const leftTime = Date.parse(left.updatedAt);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return left.chatName.localeCompare(right.chatName);
  });
}
function getChatFileKey(chatId: string, messageId: string, sandboxPath: string): string {
  return `${cleanupText(chatId)}::${cleanupText(messageId)}::${cleanupText(sandboxPath)}`;
}

function sortFiles(files: Iterable<ChatFileRecord>): ChatFileRecord[] {
  return Array.from(files).sort((left, right) => {
    const rightTime = Date.parse(right.updatedAt);
    const leftTime = Date.parse(left.updatedAt);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    const sandboxCompare = left.sandboxPath.localeCompare(right.sandboxPath);
    if (sandboxCompare !== 0) {
      return sandboxCompare;
    }

    return left.messageId.localeCompare(right.messageId);
  });
}


interface LocatedPersistentChat {
  binding: ProjectBinding;
  chat: ProjectChatRecord;
}

export class ProjectRegistry {
  private readonly bindingsByProjectId = new Map<string, ProjectBinding>();
  private readonly persistentChatsByProjectId = new Map<string, ProjectChatRecord[]>();
  private readonly persistentFilesByProjectId = new Map<string, ChatFileRecord[]>();
  private readonly persistentBundlesByProjectId = new Map<string, ProjectBundleRecord | null>();
  private temporaryProject: TemporaryProjectState | null = null;
  private lastContext: ChatPageContext | null = null;

  private constructor(private readonly store: JsonAppStore, bindings: ProjectBinding[]) {
    for (const binding of bindings) {
      this.bindingsByProjectId.set(binding.projectId, binding);
    }
  }

  public static async create(storePath: string): Promise<ProjectRegistry> {
    const store = new JsonAppStore(storePath);
    const registry = new ProjectRegistry(store, store.load().bindings);
    await registry.reloadPersistentChats();
    return registry;
  }

  public getStorePath(): string {
    return this.store.path;
  }

  public getStateSnapshot(): AppStateSnapshot {
    const temporaryProjects: SidebarProject[] = this.temporaryProject
      ? [
          {
            projectId: this.temporaryProject.projectId,
            projectName: this.temporaryProject.projectName,
            folderPath: null,
            projectUrl: this.temporaryProject.projectUrl,
            status: 'temporary',
            chats: sortChats(this.temporaryProject.chats.values()),
            files: sortFiles(this.temporaryProject.files.values()),
            bundle: null,
            lastSeenAt: this.temporaryProject.lastSeenAt,
          },
        ]
      : [];

    const persistentProjects: SidebarProject[] = Array.from(this.bindingsByProjectId.values())
      .sort((left, right) => left.projectName.localeCompare(right.projectName))
      .map((binding) => ({
        projectId: binding.projectId,
        projectName: binding.projectName,
        folderPath: binding.folderPath,
        projectUrl: binding.projectUrl,
        status: 'persistent',
        chats: sortChats(this.persistentChatsByProjectId.get(binding.projectId) ?? []),
        files: sortFiles(this.persistentFilesByProjectId.get(binding.projectId) ?? []),
        bundle: this.persistentBundlesByProjectId.get(binding.projectId) ?? null,
        lastSeenAt: binding.updatedAt,
      }));

    return {
      browserUrl: 'https://chatgpt.com',
      lastContext: this.lastContext,
      temporaryProjects,
      persistentProjects,
    };
  }

  public async handlePageContext(rawContext: unknown): Promise<void> {
    const context = this.reconcileSpeculativeContext(this.normalizeContext(rawContext));
    this.lastContext = context;

    if (!context.currentProjectId) {
      this.temporaryProject = null;
      return;
    }

    const projectId = context.currentProjectId;
    const binding = this.bindingsByProjectId.get(projectId);
    const projectName = resolveProjectName(
      projectId,
      context.currentProjectName ?? binding?.projectName ?? this.getTemporaryProject(projectId)?.projectName ?? null,
    );

    if (binding) {
      let shouldPersistBindings = false;
      const nextBindingProjectName = context.currentProjectName ?? binding.projectName;

      if (binding.projectName !== nextBindingProjectName) {
        binding.projectName = nextBindingProjectName;
        shouldPersistBindings = true;
      }

      if (binding.projectUrl !== context.projectUrl) {
        binding.projectUrl = context.projectUrl;
        shouldPersistBindings = true;
      }

      if (binding.updatedAt !== context.detectedAt) {
        binding.updatedAt = context.detectedAt;
        shouldPersistBindings = true;
      }

      if (shouldPersistBindings) {
        this.persistBindings();
      }

      await ensureProjectMetaDb({
        projectId,
        projectName,
        folderPath: binding.folderPath,
        projectUrl: context.projectUrl ?? binding.projectUrl,
      });

      if (context.currentChatId) {
        const existingChat = (this.persistentChatsByProjectId.get(projectId) ?? []).find(
          (chat) => chat.chatId === context.currentChatId,
        );
        const chat = {
          chatId: context.currentChatId,
          chatName: resolveChatName(context.currentChatId, context.currentChatName ?? existingChat?.chatName ?? null),
          projectId,
          projectName: nextBindingProjectName,
          chatUrl: context.chatUrl,
          updatedAt: context.detectedAt,
        };

        await upsertProjectChat(binding.folderPath, chat);
        this.upsertPersistentChat(chat);
      }

      this.temporaryProject = null;
      return;
    }

    const temporaryProject = this.ensureTemporaryProject(projectId, projectName, context.detectedAt);
    temporaryProject.projectName = projectName;
    temporaryProject.projectUrl = context.projectUrl;
    temporaryProject.lastSeenAt = context.detectedAt;

    if (context.currentChatId) {
      const existingChat = temporaryProject.chats.get(context.currentChatId) ?? null;
      temporaryProject.chats.set(context.currentChatId, {
        chatId: context.currentChatId,
        chatName: resolveChatName(context.currentChatId, context.currentChatName ?? existingChat?.chatName ?? null),
        projectId,
        projectName,
        chatUrl: context.chatUrl,
        updatedAt: context.detectedAt,
      });
    }
  }

  public async handleConversationHistory(rawHistory: unknown): Promise<ChatHistoryRecord | null> {
    const history = this.normalizeHistory(rawHistory);
    if (!history) {
      return null;
    }

    const binding = this.bindingsByProjectId.get(history.projectId);
    const temporaryProject = this.getTemporaryProject(history.projectId);
    const persistentChatLocations = this.findPersistentChatLocations(history.chatId);
    const existingPersistentChat = persistentChatLocations.find((entry) => entry.binding.projectId === history.projectId)?.chat ?? null;
    const existingChatInOtherProject = persistentChatLocations.find((entry) => entry.binding.projectId !== history.projectId)?.chat ?? null;
    const existingTemporaryChat = temporaryProject?.chats.get(history.chatId) ?? null;
    const existingTemporaryChatInOtherProject =
      this.temporaryProject && this.temporaryProject.projectId !== history.projectId
        ? this.temporaryProject.chats.get(history.chatId) ?? null
        : null;

    const projectName = resolveProjectName(
      history.projectId,
      history.projectName ??
        binding?.projectName ??
        temporaryProject?.projectName ??
        (this.lastContext?.currentProjectId === history.projectId ? this.lastContext.currentProjectName : null) ??
        null,
    );
    const chatName = resolveChatName(
      history.chatId,
      history.chatName ??
        existingPersistentChat?.chatName ??
        existingTemporaryChat?.chatName ??
        existingChatInOtherProject?.chatName ??
        existingTemporaryChatInOtherProject?.chatName ??
        null,
    );
    const mergedHistory: ChatHistoryRecord = {
      ...history,
      projectName,
      chatName,
      searchText: history.searchText || buildHistorySearchText(history.messages),
    };

    if (binding) {
      let shouldPersistBindings = false;
      if (binding.projectName !== projectName) {
        binding.projectName = projectName;
        shouldPersistBindings = true;
      }

      const nextBindingUpdatedAt = mergedHistory.updatedAt ?? mergedHistory.capturedAt;
      if (binding.updatedAt !== nextBindingUpdatedAt) {
        binding.updatedAt = nextBindingUpdatedAt;
        shouldPersistBindings = true;
      }

      if (shouldPersistBindings) {
        this.persistBindings();
      }

      await ensureProjectMetaDb({
        projectId: binding.projectId,
        projectName,
        folderPath: binding.folderPath,
        projectUrl: binding.projectUrl,
      });

      const persistentChat: ProjectChatRecord = {
        chatId: mergedHistory.chatId,
        chatName,
        projectId: binding.projectId,
        projectName,
        chatUrl:
          existingPersistentChat?.chatUrl ??
          existingChatInOtherProject?.chatUrl ??
          existingTemporaryChat?.chatUrl ??
          existingTemporaryChatInOtherProject?.chatUrl ??
          (this.lastContext?.currentProjectId === binding.projectId && this.lastContext.currentChatId === mergedHistory.chatId
            ? this.lastContext.chatUrl
            : null),
        updatedAt: mergedHistory.updatedAt ?? mergedHistory.capturedAt,
      };

      await upsertProjectChat(binding.folderPath, {
        chatId: persistentChat.chatId,
        chatName: persistentChat.chatName,
        projectId: persistentChat.projectId,
        projectName: persistentChat.projectName,
        chatUrl: persistentChat.chatUrl,
        updatedAt: persistentChat.updatedAt,
      });
      await upsertChatHistory(binding.folderPath, mergedHistory);
      this.upsertPersistentChat(persistentChat);
      await this.removeChatFromNonTargetProjects(mergedHistory.chatId, binding.projectId);

      if (this.temporaryProject?.projectId === binding.projectId) {
        this.temporaryProject.chats.delete(mergedHistory.chatId);
        this.temporaryProject.chatHistories.delete(mergedHistory.chatId);
        if (!this.temporaryProject.chats.size && !this.temporaryProject.chatHistories.size && !this.temporaryProject.files.size) {
          this.temporaryProject = null;
        }
      }

      return mergedHistory;
    }

    const nextTemporaryProject = this.ensureTemporaryProject(
      mergedHistory.projectId,
      projectName,
      mergedHistory.updatedAt ?? mergedHistory.capturedAt,
    );
    nextTemporaryProject.projectName = projectName;
    nextTemporaryProject.projectUrl =
      nextTemporaryProject.projectUrl ?? this.lastContext?.projectUrl ?? null;
    const mergedTemporaryHistory: ChatHistoryRecord = {
      ...mergedHistory,
      messageCount: mergedHistory.messages.length,
      searchText: mergedHistory.searchText || buildHistorySearchText(mergedHistory.messages),
    };
    nextTemporaryProject.lastSeenAt = mergedTemporaryHistory.updatedAt ?? mergedTemporaryHistory.capturedAt;
    nextTemporaryProject.chatHistories.set(mergedTemporaryHistory.chatId, mergedTemporaryHistory);
    nextTemporaryProject.chats.set(mergedTemporaryHistory.chatId, {
      chatId: mergedTemporaryHistory.chatId,
      chatName,
      projectId: mergedTemporaryHistory.projectId,
      projectName,
      chatUrl:
        existingTemporaryChat?.chatUrl ??
        existingChatInOtherProject?.chatUrl ??
        existingTemporaryChatInOtherProject?.chatUrl ??
        existingPersistentChat?.chatUrl ??
        (this.lastContext?.currentProjectId === mergedTemporaryHistory.projectId &&
        this.lastContext.currentChatId === mergedTemporaryHistory.chatId
          ? this.lastContext.chatUrl
          : null),
      updatedAt: mergedTemporaryHistory.updatedAt ?? mergedTemporaryHistory.capturedAt,
    });

    await this.removeChatFromNonTargetProjects(mergedTemporaryHistory.chatId, mergedTemporaryHistory.projectId);

    return mergedTemporaryHistory;
  }



  public async registerSandboxFile(rawFile: unknown): Promise<{ exists: boolean; downloaded: boolean; downloadPath: string | null; record: ChatFileRecord | null }> {
    const file = this.normalizeChatFile(rawFile);
    if (!file) {
      throw new Error('Sandbox file payload is invalid.');
    }

    const binding = this.bindingsByProjectId.get(file.projectId);
    const temporaryProject = this.getTemporaryProject(file.projectId);
    const projectName = resolveProjectName(
      file.projectId,
      file.projectName ?? binding?.projectName ?? temporaryProject?.projectName ?? null,
    );
    const normalizedFile: ChatFileRecord = {
      ...file,
      projectName,
    };

    if (binding) {
      await ensureProjectMetaDb({
        projectId: binding.projectId,
        projectName,
        folderPath: binding.folderPath,
        projectUrl: binding.projectUrl,
      });

      const existing = await getChatFile(binding.folderPath, normalizedFile.chatId, normalizedFile.messageId, normalizedFile.sandboxPath);
      if (!existing) {
        await upsertChatFile(binding.folderPath, normalizedFile);
      }

      const stored = existing ?? normalizedFile;
      this.upsertPersistentFile(stored);
      return {
        exists: Boolean(existing),
        downloaded: Boolean((existing ?? normalizedFile).downloadPath),
        downloadPath: existing?.downloadPath ?? null,
        record: existing ?? normalizedFile,
      };
    }

    const project = this.ensureTemporaryProject(file.projectId, projectName, file.updatedAt);
    const existing = project.files.get(getChatFileKey(file.chatId, file.messageId, file.sandboxPath)) ?? null;
    if (!existing) {
      project.files.set(getChatFileKey(file.chatId, file.messageId, file.sandboxPath), normalizedFile);
    }

    return {
      exists: Boolean(existing),
      downloaded: Boolean(existing?.downloadPath),
      downloadPath: existing?.downloadPath ?? null,
      record: existing ?? normalizedFile,
    };
  }

  public async registerSandboxFiles(rawFiles: unknown): Promise<Array<{ exists: boolean; downloaded: boolean; downloadPath: string | null; record: ChatFileRecord | null }>> {
    const entries = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
    const results: Array<{ exists: boolean; downloaded: boolean; downloadPath: string | null; record: ChatFileRecord | null }> = [];
    for (const entry of entries) {
      results.push(await this.registerSandboxFile(entry));
    }

    return results;
  }

  public async saveDownloadedSandboxFile(rawFile: unknown): Promise<ChatFileRecord> {
    const payload = this.normalizeDownloadedChatFile(rawFile);
    if (!payload) {
      throw new Error('Downloaded sandbox file payload is invalid.');
    }

    const binding = this.bindingsByProjectId.get(payload.projectId);
    if (!binding) {
      throw new Error('Connect the current ChatGPT project before downloading sandbox files.');
    }

    const savedPath = await this.writeSandboxFile(binding.folderPath, payload.sandboxPath, payload.bytes);
    const storedFile: ChatFileRecord = {
      projectId: payload.projectId,
      projectName: binding.projectName,
      chatId: payload.chatId,
      messageId: payload.messageId,
      sandboxPath: payload.sandboxPath,
      downloadUrl: payload.downloadUrl,
      downloadPath: savedPath,
      fileName: path.basename(savedPath),
      sizeBytes: payload.bytes.byteLength,
      discoveredAt: payload.discoveredAt,
      updatedAt: payload.updatedAt,
      isProject: false,
      projectSummary: null,
      projectRootInArchive: null,
      appliedAt: null,
      applyError: null,
      archiveEntryCount: null,
      hasRemoteManifest: false,
      remoteManifestProjectId: null,
      remoteManifestStatus: 'missing',
      gitBundle: null,
    };

    await ensureProjectMetaDb({
      projectId: binding.projectId,
      projectName: binding.projectName,
      folderPath: binding.folderPath,
      projectUrl: binding.projectUrl,
    });

    let archiveEntries: ChatFileArchiveEntryRecord[] = [];
    if (isDownloadedZipFile(storedFile)) {
      try {
        const inspection = await inspectDownloadedArchive(savedPath, binding.projectId);
        archiveEntries = inspection.entries;
        storedFile.isProject = inspection.isProject;
        storedFile.hasRemoteManifest = inspection.hasRemoteManifest;
        storedFile.remoteManifestProjectId = inspection.remoteManifestProjectId;
        storedFile.remoteManifestStatus = inspection.remoteManifestStatus;
        storedFile.projectSummary = inspection.projectSummary;
        storedFile.projectRootInArchive = inspection.projectRootInArchive;
        storedFile.archiveEntryCount = inspection.entries.length;
      } catch (error) {
        storedFile.applyError = error instanceof Error ? error.message : String(error);
      }
    }

    if (isDownloadedGitBundleFile(storedFile)) {
      try {
        storedFile.gitBundle = await inspectDownloadedGitBundle(binding.folderPath, savedPath);
        storedFile.applyError = storedFile.gitBundle.status === 'ready' ? null : storedFile.gitBundle.message;
      } catch (error) {
        storedFile.gitBundle = {
          status: 'error',
          branches: [],
          latestBranch: null,
          message: error instanceof Error ? error.message : String(error),
          inspectedAt: new Date().toISOString(),
        };
        storedFile.applyError = storedFile.gitBundle.message;
      }
    }

    await upsertChatFile(binding.folderPath, storedFile);
    await replaceChatFileArchiveEntries(
      binding.folderPath,
      storedFile.chatId,
      storedFile.messageId,
      storedFile.sandboxPath,
      archiveEntries.map((entry) => ({
        chatId: storedFile.chatId,
        messageId: storedFile.messageId,
        sandboxPath: storedFile.sandboxPath,
        relativePath: entry.relativePath,
        kind: entry.kind,
        sizeBytes: entry.sizeBytes,
        crc32: entry.crc32 ?? null,
      })),
    );
    this.upsertPersistentFile(storedFile);

    const temporaryProject = this.getTemporaryProject(payload.projectId);
    temporaryProject?.files.delete(getChatFileKey(payload.chatId, payload.messageId, payload.sandboxPath));

    return storedFile;
  }

  public async listSandboxFileArchiveEntries(projectId: string, chatId: string, messageId: string, sandboxPath: string): Promise<ChatFileArchiveEntryRecord[]> {
    const normalizedProjectId = cleanupText(projectId);
    const normalizedChatId = cleanupText(chatId);
    const normalizedMessageId = cleanupText(messageId);
    const normalizedSandboxPath = cleanupText(sandboxPath);
    if (!normalizedProjectId || !normalizedChatId || !normalizedMessageId || !normalizedSandboxPath) {
      return [];
    }

    const binding = this.bindingsByProjectId.get(normalizedProjectId);
    if (!binding) {
      return [];
    }

    const storedEntries = await listChatFileArchiveEntries(binding.folderPath, normalizedChatId, normalizedMessageId, normalizedSandboxPath);
    return compareArchiveEntriesAgainstProject(binding.folderPath, storedEntries);
  }

  public async applySandboxFile(
    projectId: string,
    chatId: string,
    messageId: string,
    sandboxPath: string,
    relativePath?: string | null,
  ): Promise<ApplySandboxFileResult> {
    const normalizedProjectId = cleanupText(projectId);
    const normalizedChatId = cleanupText(chatId);
    const normalizedMessageId = cleanupText(messageId);
    const normalizedSandboxPath = cleanupText(sandboxPath);
    const normalizedRelativePath = normalizeNullableText(relativePath);
    if (!normalizedProjectId || !normalizedChatId || !normalizedMessageId || !normalizedSandboxPath) {
      throw new Error('File identity is incomplete.');
    }

    const binding = this.bindingsByProjectId.get(normalizedProjectId);
    if (!binding) {
      throw new Error('Connect the current project before applying files.');
    }

    const existingFile = await getChatFile(binding.folderPath, normalizedChatId, normalizedMessageId, normalizedSandboxPath);
    if (!existingFile) {
      throw new Error('The file is no longer available in project metadata.');
    }

    try {
      const applyResult = await applyDownloadedSandboxFile(binding.folderPath, existingFile, normalizedRelativePath ?? null);
      const nextFile: ChatFileRecord = {
        ...existingFile,
        projectName: binding.projectName,
        appliedAt: applyResult.appliedAt,
        applyError: null,
        gitBundle: applyResult.gitBundle ?? existingFile.gitBundle ?? null,
      };
      await upsertChatFile(binding.folderPath, nextFile);
      this.upsertPersistentFile(nextFile);
      return {
        file: nextFile,
        updatedFileCount: applyResult.updatedFileCount,
        message: applyResult.message ?? null,
      };
    } catch (error) {
      const nextFile: ChatFileRecord = {
        ...existingFile,
        projectName: binding.projectName,
        applyError: error instanceof Error ? error.message : String(error),
      };
      await upsertChatFile(binding.folderPath, nextFile);
      this.upsertPersistentFile(nextFile);
      throw error;
    }
  }

  public async connectProject(
    projectId: string,
    parentWindow: BrowserWindow,
  ): Promise<{ binding: ProjectBinding; metaDbPath: string } | null> {
    const normalizedProjectId = cleanupText(projectId);
    if (!normalizedProjectId) {
      throw new Error('Project id is empty.');
    }

    const temporaryProject = this.getTemporaryProject(normalizedProjectId);
    const existingBinding = this.bindingsByProjectId.get(normalizedProjectId);
    const projectName = resolveProjectName(
      normalizedProjectId,
      temporaryProject?.projectName ?? existingBinding?.projectName ?? null,
    );

    const result = await dialog.showOpenDialog(parentWindow, {
      title: `Connect project: ${projectName}`,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const folderPath = result.filePaths[0];
    const conflictingBinding = Array.from(this.bindingsByProjectId.values()).find(
      (binding) =>
        binding.projectId !== normalizedProjectId &&
        normalizeComparablePath(binding.folderPath) === normalizeComparablePath(folderPath),
    );

    if (conflictingBinding) {
      throw new Error(`This folder is already connected to project "${conflictingBinding.projectName}".`);
    }

    const timestamp = new Date().toISOString();
    const binding: ProjectBinding = {
      projectId: normalizedProjectId,
      projectName,
      folderPath,
      projectUrl: temporaryProject?.projectUrl ?? existingBinding?.projectUrl ?? this.lastContext?.projectUrl ?? null,
      createdAt: existingBinding?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    const metaDbPath = await ensureProjectMetaDb({
      projectId: binding.projectId,
      projectName: binding.projectName,
      folderPath: binding.folderPath,
      projectUrl: binding.projectUrl,
    });

    const chatsToPersist = temporaryProject ? sortChats(temporaryProject.chats.values()) : [];
    for (const chat of chatsToPersist) {
      await upsertProjectChat(folderPath, {
        chatId: chat.chatId,
        chatName: chat.chatName,
        projectId: chat.projectId,
        projectName: chat.projectName,
        chatUrl: chat.chatUrl,
        updatedAt: chat.updatedAt,
      });
    }

    const historiesToPersist = temporaryProject ? Array.from(temporaryProject.chatHistories.values()) : [];
    for (const history of historiesToPersist) {
      await upsertChatHistory(folderPath, {
        projectId: history.projectId,
        projectName: history.projectName,
        chatId: history.chatId,
        chatName: history.chatName,
        messageCount: history.messageCount,
        messages: history.messages,
        searchText: history.searchText,
        updatedAt: history.updatedAt,
        capturedAt: history.capturedAt,
      });
    }

    const filesToPersist = temporaryProject ? Array.from(temporaryProject.files.values()) : [];
    for (const file of filesToPersist) {
      await upsertChatFile(folderPath, file);
    }

    this.bindingsByProjectId.set(binding.projectId, binding);
    this.persistBindings();
    if (this.temporaryProject?.projectId === binding.projectId) {
      this.temporaryProject = null;
    }
    this.persistentChatsByProjectId.set(binding.projectId, await listProjectChats(folderPath));
    this.persistentFilesByProjectId.set(binding.projectId, await listProjectFiles(folderPath));
    this.persistentBundlesByProjectId.set(binding.projectId, await getProjectBundle(folderPath));

    return {
      binding,
      metaDbPath,
    };
  }

  public async openProjectFolder(folderPath: string): Promise<string> {
    return resolveProjectMetaDbPath(folderPath);
  }

  public async getChatHistory(projectId: string, chatId: string): Promise<ChatHistoryRecord | null> {
    const normalizedProjectId = cleanupText(projectId);
    const normalizedChatId = cleanupText(chatId);
    if (!normalizedProjectId || !normalizedChatId) {
      return null;
    }

    const binding = this.bindingsByProjectId.get(normalizedProjectId);
    if (!binding) {
      return null;
    }

    return getPersistedChatHistory(binding.folderPath, normalizedChatId);
  }

  public async getChatMessageThoughts(
    projectId: string,
    chatId: string,
    messageId: string,
  ): Promise<import('../shared/contracts').ChatHistoryReasoningStep[]> {
    const normalizedProjectId = cleanupText(projectId);
    const normalizedChatId = cleanupText(chatId);
    const normalizedMessageId = cleanupText(messageId);
    if (!normalizedProjectId || !normalizedChatId || !normalizedMessageId) {
      return [];
    }

    const binding = this.bindingsByProjectId.get(normalizedProjectId);
    if (!binding) {
      return [];
    }

    return getChatMessageThoughts(binding.folderPath, normalizedChatId, normalizedMessageId);
  }

  public async createBundle(projectId: string): Promise<ProjectBundleRecord> {
    const normalizedProjectId = cleanupText(projectId);
    if (!normalizedProjectId) {
      throw new Error('Project id is empty.');
    }

    const binding = this.bindingsByProjectId.get(normalizedProjectId);
    if (!binding) {
      throw new Error('Connect the project to a local folder before creating a bundle.');
    }

    await ensureProjectMetaDb({
      projectId: binding.projectId,
      projectName: binding.projectName,
      folderPath: binding.folderPath,
      projectUrl: binding.projectUrl,
    });

    const generatedBundle = await createProjectBundle(binding.projectId, binding.projectName, binding.folderPath);
    await upsertProjectBundle(binding.folderPath, {
      projectId: binding.projectId,
      bundlePath: generatedBundle.bundlePath,
      createdAt: generatedBundle.createdAt,
      sizeBytes: generatedBundle.sizeBytes,
      files: generatedBundle.files,
    });

    const storedBundle: ProjectBundleRecord = {
      projectId: binding.projectId,
      bundlePath: generatedBundle.bundlePath,
      createdAt: generatedBundle.createdAt,
      sizeBytes: generatedBundle.sizeBytes,
      fileCount: generatedBundle.files.length,
      files: generatedBundle.files,
    };

    this.persistentBundlesByProjectId.set(binding.projectId, storedBundle);
    return storedBundle;
  }

  public async removeChat(projectId: string, chatId: string): Promise<boolean> {
    const normalizedProjectId = cleanupText(projectId);
    const normalizedChatId = cleanupText(chatId);
    if (!normalizedProjectId || !normalizedChatId) {
      return false;
    }

    const binding = this.bindingsByProjectId.get(normalizedProjectId) ?? null;
    if (binding) {
      await deleteChatArtifacts(binding.folderPath, normalizedChatId);
      this.persistentChatsByProjectId.set(
        normalizedProjectId,
        (this.persistentChatsByProjectId.get(normalizedProjectId) ?? []).filter((chat) => chat.chatId !== normalizedChatId),
      );
      this.persistentFilesByProjectId.set(
        normalizedProjectId,
        (this.persistentFilesByProjectId.get(normalizedProjectId) ?? []).filter((file) => file.chatId !== normalizedChatId),
      );
      return true;
    }

    const temporaryProject = this.getTemporaryProject(normalizedProjectId);
    if (!temporaryProject) {
      return false;
    }

    const hadAnything =
      temporaryProject.chats.delete(normalizedChatId) ||
      temporaryProject.chatHistories.delete(normalizedChatId);
    for (const [fileKey, file] of temporaryProject.files.entries()) {
      if (file.chatId === normalizedChatId) {
        temporaryProject.files.delete(fileKey);
      }
    }

    if (!temporaryProject.chats.size && !temporaryProject.chatHistories.size && !temporaryProject.files.size) {
      this.temporaryProject = null;
    }

    return hadAnything;
  }

  public removeProject(projectId: string): boolean {
    const normalizedProjectId = cleanupText(projectId);
    if (!normalizedProjectId) {
      return false;
    }

    const binding = this.bindingsByProjectId.get(normalizedProjectId);
    if (!binding) {
      return false;
    }

    this.bindingsByProjectId.delete(normalizedProjectId);
    this.persistentChatsByProjectId.delete(normalizedProjectId);
    this.persistentFilesByProjectId.delete(normalizedProjectId);
    this.persistentBundlesByProjectId.delete(normalizedProjectId);
    this.persistBindings();

    if (this.lastContext?.currentProjectId === normalizedProjectId) {
      const projectName = resolveProjectName(
        normalizedProjectId,
        this.lastContext.currentProjectName ?? binding.projectName,
      );
      const temporaryProject = this.ensureTemporaryProject(normalizedProjectId, projectName, this.lastContext.detectedAt);
      temporaryProject.projectName = projectName;
      temporaryProject.projectUrl = this.lastContext.projectUrl ?? binding.projectUrl;
      temporaryProject.lastSeenAt = this.lastContext.detectedAt;
      temporaryProject.chats.clear();
      temporaryProject.chatHistories.clear();
      temporaryProject.files.clear();

      if (this.lastContext.currentChatId) {
        temporaryProject.chats.set(this.lastContext.currentChatId, {
          chatId: this.lastContext.currentChatId,
          chatName: resolveChatName(this.lastContext.currentChatId, this.lastContext.currentChatName),
          projectId: normalizedProjectId,
          projectName,
          chatUrl: this.lastContext.chatUrl,
          updatedAt: this.lastContext.detectedAt,
        });
      }
    }

    return true;
  }

  private findPersistentChatLocations(chatId: string): LocatedPersistentChat[] {
    const normalizedChatId = cleanupText(chatId);
    if (!normalizedChatId) {
      return [];
    }

    const locations: LocatedPersistentChat[] = [];
    for (const binding of this.bindingsByProjectId.values()) {
      const chat = (this.persistentChatsByProjectId.get(binding.projectId) ?? []).find(
        (candidate) => candidate.chatId === normalizedChatId,
      );
      if (chat) {
        locations.push({ binding, chat });
      }
    }

    return locations;
  }

  private async removeChatFromNonTargetProjects(chatId: string, targetProjectId: string): Promise<void> {
    const normalizedChatId = cleanupText(chatId);
    const normalizedTargetProjectId = cleanupText(targetProjectId);
    if (!normalizedChatId || !normalizedTargetProjectId) {
      return;
    }

    for (const binding of this.bindingsByProjectId.values()) {
      if (binding.projectId === normalizedTargetProjectId) {
        continue;
      }

      await deleteChatArtifacts(binding.folderPath, normalizedChatId);
      const remainingChats = (this.persistentChatsByProjectId.get(binding.projectId) ?? []).filter(
        (candidate) => candidate.chatId !== normalizedChatId,
      );
      this.persistentChatsByProjectId.set(binding.projectId, remainingChats);
      const remainingFiles = (this.persistentFilesByProjectId.get(binding.projectId) ?? []).filter(
        (candidate) => candidate.chatId !== normalizedChatId,
      );
      this.persistentFilesByProjectId.set(binding.projectId, remainingFiles);
    }

    if (this.temporaryProject?.projectId && this.temporaryProject.projectId !== normalizedTargetProjectId) {
      this.temporaryProject.chats.delete(normalizedChatId);
      this.temporaryProject.chatHistories.delete(normalizedChatId);
      for (const [fileKey, file] of this.temporaryProject.files.entries()) {
        if (file.chatId === normalizedChatId) {
          this.temporaryProject.files.delete(fileKey);
        }
      }
      if (!this.temporaryProject.chats.size && !this.temporaryProject.chatHistories.size && !this.temporaryProject.files.size) {
        this.temporaryProject = null;
      }
    }
  }

  private async reloadPersistentChats(): Promise<void> {
    for (const binding of this.bindingsByProjectId.values()) {
      this.persistentChatsByProjectId.set(binding.projectId, await listProjectChats(binding.folderPath));
      this.persistentFilesByProjectId.set(binding.projectId, await listProjectFiles(binding.folderPath));
      this.persistentBundlesByProjectId.set(binding.projectId, await getProjectBundle(binding.folderPath));
    }
  }

  private ensureTemporaryProject(projectId: string, projectName: string, lastSeenAt: string): TemporaryProjectState {
    const existing = this.getTemporaryProject(projectId);
    if (existing) {
      return existing;
    }

    const created: TemporaryProjectState = {
      projectId,
      projectName,
      projectUrl: this.lastContext?.projectUrl ?? null,
      chats: new Map<string, ProjectChatRecord>(),
      chatHistories: new Map<string, ChatHistoryRecord>(),
      files: new Map<string, ChatFileRecord>(),
      lastSeenAt,
    };

    this.temporaryProject = created;
    return created;
  }

  private getTemporaryProject(projectId: string): TemporaryProjectState | null {
    return this.temporaryProject?.projectId === projectId ? this.temporaryProject : null;
  }

  private reconcileSpeculativeContext(context: ChatPageContext): ChatPageContext {
    const currentChatId = context.currentChatId;
    const currentProjectId = context.currentProjectId;
    if (!currentChatId || !currentProjectId) {
      return context;
    }

    const persistentLocations = this.findPersistentChatLocations(currentChatId);
    const knownProjectIds = new Set<string>(persistentLocations.map((entry) => entry.binding.projectId));
    if (this.temporaryProject?.chats.has(currentChatId)) {
      knownProjectIds.add(this.temporaryProject.projectId);
    }

    if (!knownProjectIds.size || knownProjectIds.has(currentProjectId) || knownProjectIds.size !== 1) {
      return context;
    }

    const resolvedProjectId = Array.from(knownProjectIds)[0] ?? null;
    if (!resolvedProjectId) {
      return context;
    }

    const resolvedBinding = this.bindingsByProjectId.get(resolvedProjectId) ?? null;
    const resolvedPersistentChat =
      persistentLocations.find((entry) => entry.binding.projectId === resolvedProjectId)?.chat ?? null;
    const resolvedTemporaryProject = this.getTemporaryProject(resolvedProjectId);
    const resolvedTemporaryChat = resolvedTemporaryProject?.chats.get(currentChatId) ?? null;

    return {
      ...context,
      currentProjectId: resolvedProjectId,
      currentProjectName:
        resolvedBinding?.projectName ?? resolvedTemporaryProject?.projectName ?? context.currentProjectName,
      projectUrl: resolvedBinding?.projectUrl ?? resolvedTemporaryProject?.projectUrl ?? context.projectUrl,
      currentChatName:
        resolvedPersistentChat?.chatName ?? resolvedTemporaryChat?.chatName ?? context.currentChatName,
      chatUrl: resolvedPersistentChat?.chatUrl ?? resolvedTemporaryChat?.chatUrl ?? context.chatUrl,
    };
  }

  private normalizeContext(rawContext: unknown): ChatPageContext {
    const candidate = rawContext && typeof rawContext === 'object' ? (rawContext as Record<string, unknown>) : {};

    return {
      currentProjectId: normalizeNullableText(candidate.currentProjectId),
      currentProjectName: normalizeNullableText(candidate.currentProjectName),
      currentChatId: normalizeNullableText(candidate.currentChatId),
      currentChatName: normalizeNullableText(candidate.currentChatName),
      pageUrl: normalizeNullableText(candidate.pageUrl ?? candidate.sourceUrl),
      projectUrl: normalizeNullableText(candidate.projectUrl ?? candidate.sourceUrl),
      chatUrl: normalizeNullableText(candidate.chatUrl ?? candidate.sourceUrl),
      detectedAt: ensureTimestamp(candidate.detectedAt),
    };
  }

  private normalizeHistory(rawHistory: unknown): ChatHistoryRecord | null {
    const candidate = rawHistory && typeof rawHistory === 'object' ? (rawHistory as Record<string, unknown>) : null;
    if (!candidate) {
      return null;
    }

    const projectId = normalizeNullableText(candidate.projectId);
    const chatId = normalizeNullableText(candidate.chatId);
    if (!projectId || !chatId) {
      return null;
    }

    const rawMessages = Array.isArray(candidate.messages) ? candidate.messages : [];
    const messages = rawMessages
      .map((entry) => this.normalizeHistoryMessage(entry))
      .filter((entry): entry is ChatHistoryMessageRecord => Boolean(entry));
    const capturedAt = ensureTimestamp(candidate.capturedAt);
    const updatedAt = ensureNullableTimestamp(candidate.updatedAt);

    return {
      projectId,
      projectName: normalizeNullableText(candidate.projectName),
      chatId,
      chatName: normalizeNullableText(candidate.chatName),
      messageCount: Number.isFinite(Number(candidate.messageCount)) ? Number(candidate.messageCount) : messages.length,
      messages,
      searchText: cleanupText(candidate.searchText),
      updatedAt,
      capturedAt,
      isPartial: candidate.isPartial === true,
    };
  }

  private normalizeHistoryMessage(rawMessage: unknown): ChatHistoryMessageRecord | null {
    const candidate = rawMessage && typeof rawMessage === 'object' ? (rawMessage as Record<string, unknown>) : null;
    if (!candidate) {
      return null;
    }

    const text = typeof candidate.text === 'string' ? candidate.text : '';
    if (!text) {
      return null;
    }

    const role =
      candidate.role === 'assistant' ||
      candidate.role === 'system' ||
      candidate.role === 'tool' ||
      candidate.role === 'user' ||
      candidate.role === 'unknown'
        ? candidate.role
        : 'unknown';

    const reasoningCandidate =
      candidate.reasoning && typeof candidate.reasoning === 'object' && !Array.isArray(candidate.reasoning)
        ? (candidate.reasoning as Record<string, unknown>)
        : null;

    const partsCandidate = Array.isArray(candidate.parts) ? candidate.parts : null;

    return {
      messageId: normalizeNullableText(candidate.messageId ?? candidate.id),
      parentMessageId: normalizeNullableText(candidate.parentMessageId),
      turnId: normalizeNullableText(candidate.turnId),
      role,
      text,
      createdAt: ensureNullableTimestamp(candidate.createdAt),
      updatedAt: ensureNullableTimestamp(candidate.updatedAt),
      contentType: normalizeNullableText(candidate.contentType),
      messageType: normalizeNullableText(candidate.messageType),
      language: normalizeNullableText(candidate.language),
      parts: partsCandidate
        ? partsCandidate
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
            .map((entry) => ({
              kind:
                entry.kind === 'image' || entry.kind === 'attachment' || entry.kind === 'text'
                  ? entry.kind
                  : 'unknown',
              text: typeof entry.text === 'string' ? entry.text : null,
              assetPointer: typeof entry.assetPointer === 'string' ? entry.assetPointer : null,
              mimeType: typeof entry.mimeType === 'string' ? entry.mimeType : null,
              width: typeof entry.width === 'number' ? entry.width : null,
              height: typeof entry.height === 'number' ? entry.height : null,
            }))
        : null,
      isHidden: candidate.isHidden === true,
      endTurn: typeof candidate.endTurn === 'boolean' ? candidate.endTurn : null,
      status: normalizeNullableText(candidate.status),
      reasoning: reasoningCandidate
        ? {
            recap: typeof reasoningCandidate.recap === 'string' && reasoningCandidate.recap ? reasoningCandidate.recap : text,
            finishedDurationSec:
              typeof reasoningCandidate.finishedDurationSec === 'number'
                ? reasoningCandidate.finishedDurationSec
                : null,
            startedAt: ensureNullableTimestamp(reasoningCandidate.startedAt),
            endedAt: ensureNullableTimestamp(reasoningCandidate.endedAt),
            steps: Array.isArray(reasoningCandidate.steps)
              ? (reasoningCandidate.steps as unknown[])
                  .map((rawStep) => {
                    if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep)) {
                      return null;
                    }
                    const candidateStep = rawStep as Record<string, unknown>;
                    const content = typeof candidateStep.content === 'string' ? candidateStep.content : '';
                    const chunks = Array.isArray(candidateStep.chunks)
                      ? candidateStep.chunks
                          .map((entry) => (typeof entry === 'string' ? entry : ''))
                          .filter((entry): entry is string => Boolean(entry))
                      : [];
                    if (!content && !chunks.length) {
                      return null;
                    }
                    return {
                      summary: normalizeNullableText(candidateStep.summary),
                      content: content || chunks.join('\n\n'),
                      chunks,
                    };
                  })
                  .filter(
                    (entry): entry is NonNullable<NonNullable<ChatHistoryMessageRecord['reasoning']>['steps']>[number] =>
                      Boolean(entry),
                  )
              : [],
            stepsLoaded: reasoningCandidate.stepsLoaded === true,
          }
        : null,
      metadataJson: typeof candidate.metadataJson === 'string' ? candidate.metadataJson : null,
    };
  }

  private upsertPersistentChat(nextChat: ProjectChatRecord): void {
    const currentChats = this.persistentChatsByProjectId.get(nextChat.projectId) ?? [];
    const remainingChats = currentChats.filter((chat) => chat.chatId !== nextChat.chatId);
    this.persistentChatsByProjectId.set(nextChat.projectId, sortChats([nextChat, ...remainingChats]));
  }



  private upsertPersistentFile(nextFile: ChatFileRecord): void {
    const currentFiles = this.persistentFilesByProjectId.get(nextFile.projectId) ?? [];
    const remainingFiles = currentFiles.filter(
      (file) => getChatFileKey(file.chatId, file.messageId, file.sandboxPath) !== getChatFileKey(nextFile.chatId, nextFile.messageId, nextFile.sandboxPath),
    );
    this.persistentFilesByProjectId.set(nextFile.projectId, sortFiles([nextFile, ...remainingFiles]));
  }

  private normalizeChatFile(rawFile: unknown): ChatFileRecord | null {
    const candidate = rawFile && typeof rawFile === 'object' ? (rawFile as Record<string, unknown>) : null;
    if (!candidate) {
      return null;
    }

    const projectId = normalizeNullableText(candidate.projectId);
    const chatId = normalizeNullableText(candidate.chatId);
    const messageId = normalizeNullableText(candidate.messageId);
    const sandboxPath = normalizeNullableText(candidate.sandboxPath);
    if (!projectId || !chatId || !messageId || !sandboxPath) {
      return null;
    }

    return {
      projectId,
      projectName: normalizeNullableText(candidate.projectName),
      chatId,
      messageId,
      sandboxPath,
      downloadUrl: normalizeNullableText(candidate.downloadUrl),
      downloadPath: normalizeNullableText(candidate.downloadPath),
      fileName: normalizeNullableText(candidate.fileName) ?? path.basename(sandboxPath),
      sizeBytes: typeof candidate.sizeBytes === 'number' && Number.isFinite(candidate.sizeBytes) ? candidate.sizeBytes : null,
      discoveredAt: ensureTimestamp(candidate.discoveredAt),
      updatedAt: ensureTimestamp(candidate.updatedAt ?? candidate.discoveredAt),
    };
  }

  private normalizeDownloadedChatFile(rawFile: unknown): (ChatFileRecord & { bytes: Uint8Array }) | null {
    const base = this.normalizeChatFile(rawFile);
    const candidate = rawFile && typeof rawFile === 'object' ? (rawFile as Record<string, unknown>) : null;
    if (!base || !candidate) {
      return null;
    }

    const rawBytes = candidate.bytes;
    const bytes = rawBytes instanceof Uint8Array ? rawBytes : rawBytes instanceof ArrayBuffer ? new Uint8Array(rawBytes) : null;
    if (!bytes || !bytes.byteLength) {
      return null;
    }

    return {
      ...base,
      bytes,
      downloadUrl: normalizeNullableText(candidate.downloadUrl),
      downloadPath: normalizeNullableText(candidate.downloadPath),
      fileName: normalizeNullableText(candidate.fileName) ?? path.basename(base.sandboxPath),
      updatedAt: ensureTimestamp(candidate.updatedAt ?? candidate.discoveredAt),
    };
  }

  private async writeSandboxFile(folderPath: string, sandboxPath: string, bytes: Uint8Array): Promise<string> {
    const { access, mkdir, writeFile } = await import('node:fs/promises');
    const normalizedSandboxPath = sandboxPath.replace(/\\/g, '/');
    const relativeSandboxPath = normalizedSandboxPath
      .replace(/^sandbox:\/mnt\/data\//, '')
      .replace(/^\/mnt\/data\//, '')
      .replace(/^\/+/, '');
    const safeRelativePath = relativeSandboxPath.split('/').filter(Boolean).join(path.sep) || path.basename(normalizedSandboxPath);
    const baseTargetPath = path.join(folderPath, '.chatgpt', 'files', safeRelativePath);
    const targetDirectory = path.dirname(baseTargetPath);
    const parsedTargetPath = path.parse(baseTargetPath);

    await mkdir(targetDirectory, { recursive: true });

    let candidatePath = baseTargetPath;
    let suffix = 1;

    while (true) {
      try {
        await access(candidatePath);
        const suffixLabel = ` (${suffix})`;
        candidatePath = path.join(parsedTargetPath.dir, `${parsedTargetPath.name}${suffixLabel}${parsedTargetPath.ext}`);
        suffix += 1;
      } catch {
        break;
      }
    }

    await writeFile(candidatePath, Buffer.from(bytes));
    return candidatePath;
  }

  private persistBindings(): void {
    const bindings = Array.from(this.bindingsByProjectId.values()).sort((left, right) =>
      left.projectName.localeCompare(right.projectName),
    );

    this.store.save({
      version: 1,
      bindings,
    });
  }
}
