import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import {
  ChatFileArchiveEntryRecord,
  ChatFileRecord,
  GitBundleInspection,
  ChatHistoryMessageRecord,
  ChatHistoryReasoningStep,
  ChatHistoryRecord,
  ProjectChatRecord,
  ProjectBundleFileRecord,
  ProjectBundleRecord,
  RemoteManifestStatus,
} from '../shared/contracts';

export interface ProjectMetaIdentity {
  projectId: string;
  projectName: string;
  folderPath: string;
  projectUrl: string | null;
}

export interface ProjectChatUpsertInput {
  projectId: string;
  projectName: string | null;
  chatId: string;
  chatName: string;
  chatUrl: string | null;
  updatedAt: string;
}


export interface ProjectChatFileUpsertInput {
  projectId: string;
  projectName: string | null;
  chatId: string;
  messageId: string;
  sandboxPath: string;
  downloadUrl: string | null;
  downloadPath: string | null;
  fileName: string | null;
  discoveredAt: string;
  updatedAt: string;
  isProject?: boolean;
  projectSummary?: string | null;
  projectRootInArchive?: string | null;
  appliedAt?: string | null;
  applyError?: string | null;
  archiveEntryCount?: number | null;
  hasRemoteManifest?: boolean;
  remoteManifestProjectId?: string | null;
  remoteManifestStatus?: RemoteManifestStatus | null;
  gitBundle?: GitBundleInspection | null;
}

export interface ProjectChatFileArchiveEntryUpsertInput {
  chatId: string;
  messageId: string;
  sandboxPath: string;
  relativePath: string;
  kind: 'file' | 'directory';
  sizeBytes: number;
  crc32?: number | null;
}

export interface ProjectChatHistoryUpsertInput {
  projectId: string;
  projectName: string | null;
  chatId: string;
  chatName: string | null;
  messageCount: number;
  messages: ChatHistoryMessageRecord[];
  searchText: string;
  updatedAt: string | null;
  capturedAt: string;
}

export interface ProjectBundleUpsertInput {
  projectId: string;
  bundlePath: string;
  createdAt: string;
  sizeBytes: number | null;
  files: ProjectBundleFileRecord[];
}

const META_DIRECTORY_NAME = '.chatgpt';
const META_DB_NAME = 'meta.db';

let sqlPromise: Promise<SqlJsStatic> | null = null;

function cleanupText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeMessageText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';
}

function normalizeReasoningStep(value: unknown): ChatHistoryReasoningStep | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const content = normalizeMessageText(candidate.content);
  const chunks = Array.isArray(candidate.chunks)
    ? candidate.chunks.map((entry) => normalizeMessageText(entry)).filter((entry): entry is string => Boolean(entry))
    : [];

  if (!content && !chunks.length) {
    return null;
  }

  return {
    summary: normalizeNullableText(candidate.summary),
    content: content || chunks.join('\n\n'),
    chunks,
  };
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = cleanupText(value);
  return normalized || null;
}

function ensureIsoTimestamp(value: unknown): string | null {
  const normalized = cleanupText(value);
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function resolveFileSize(downloadPath: string | null): number | null {
  if (!downloadPath) {
    return null;
  }

  try {
    return statSync(downloadPath).size;
  } catch {
    return null;
  }
}

function isMessageRole(value: unknown): value is ChatHistoryMessageRecord['role'] {
  return value === 'assistant' || value === 'system' || value === 'tool' || value === 'user' || value === 'unknown';
}

function normalizeHistoryMessageRecord(value: unknown): ChatHistoryMessageRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const text = normalizeMessageText(candidate.text);
  if (!text) {
    return null;
  }

  return {
    messageId: normalizeNullableText(candidate.messageId ?? candidate.id),
    role: isMessageRole(candidate.role) ? candidate.role : 'unknown',
    text,
    createdAt: ensureIsoTimestamp(candidate.createdAt),
    updatedAt: ensureIsoTimestamp(candidate.updatedAt),
    contentType: normalizeNullableText(candidate.contentType),
    reasoning:
      candidate.reasoning && typeof candidate.reasoning === 'object' && !Array.isArray(candidate.reasoning)
        ? {
            recap: normalizeMessageText((candidate.reasoning as Record<string, unknown>).recap) || text,
            steps: Array.isArray((candidate.reasoning as Record<string, unknown>).steps)
              ? ((candidate.reasoning as Record<string, unknown>).steps as unknown[])
                  .map((entry) => normalizeReasoningStep(entry))
                  .filter((entry): entry is ChatHistoryReasoningStep => Boolean(entry))
              : [],
          }
        : null,
  };
}

async function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    sqlPromise = initSqlJs({
      locateFile: () => wasmPath,
    });
  }

  return sqlPromise;
}

function initializeSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS project_meta (
      project_id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      source_url TEXT,
      project_url TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      chat_id TEXT PRIMARY KEY,
      chat_name TEXT NOT NULL,
      project_id TEXT NOT NULL,
      project_name TEXT,
      source_url TEXT,
      chat_url TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);

    CREATE TABLE IF NOT EXISTS chat_history (
      chat_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT,
      chat_name TEXT,
      message_count INTEGER NOT NULL,
      search_text TEXT,
      history_json TEXT NOT NULL,
      updated_at TEXT,
      captured_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON chat_history(project_id);

    CREATE TABLE IF NOT EXISTS chat_files (
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      sandbox_path TEXT NOT NULL,
      project_id TEXT NOT NULL,
      project_name TEXT,
      download_url TEXT,
      download TEXT,
      file_name TEXT,
      discovered_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_project INTEGER NOT NULL DEFAULT 0,
      project_summary TEXT,
      project_root_in_archive TEXT,
      applied_at TEXT,
      apply_error TEXT,
      archive_entry_count INTEGER,
      has_remote_manifest INTEGER NOT NULL DEFAULT 0,
      remote_manifest_project_id TEXT,
      remote_manifest_status TEXT,
      git_bundle_json TEXT,
      PRIMARY KEY (chat_id, message_id, sandbox_path)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_files_project_id ON chat_files(project_id);
    CREATE INDEX IF NOT EXISTS idx_chat_files_chat_id ON chat_files(chat_id);

    CREATE TABLE IF NOT EXISTS chat_file_archive_entries (
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      sandbox_path TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      kind TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      crc32 INTEGER,
      PRIMARY KEY (chat_id, message_id, sandbox_path, relative_path)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_file_archive_entries_chat_file
      ON chat_file_archive_entries(chat_id, message_id, sandbox_path);

    CREATE TABLE IF NOT EXISTS project_bundle (
      project_id TEXT PRIMARY KEY,
      bundle_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      size_bytes INTEGER,
      file_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS project_bundle_files (
      project_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      PRIMARY KEY (project_id, relative_path)
    );

    CREATE INDEX IF NOT EXISTS idx_project_bundle_files_project_id ON project_bundle_files(project_id);
  `);

  ensureColumn(db, 'project_meta', 'source_url', 'TEXT');
  ensureColumn(db, 'project_meta', 'project_url', 'TEXT');
  ensureColumn(db, 'chats', 'source_url', 'TEXT');
  ensureColumn(db, 'chats', 'chat_url', 'TEXT');
  ensureColumn(db, 'chat_history', 'project_name', 'TEXT');
  ensureColumn(db, 'chat_history', 'chat_name', 'TEXT');
  ensureColumn(db, 'chat_history', 'message_count', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'chat_history', 'search_text', 'TEXT');
  ensureColumn(db, 'chat_history', 'history_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'chat_history', 'updated_at', 'TEXT');
  ensureColumn(db, 'chat_history', 'captured_at', "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'");
  ensureColumn(db, 'chat_files', 'project_name', 'TEXT');
  ensureColumn(db, 'chat_files', 'download_url', 'TEXT');
  ensureColumn(db, 'chat_files', 'download', 'TEXT');
  ensureColumn(db, 'chat_files', 'file_name', 'TEXT');
  ensureColumn(db, 'chat_files', 'discovered_at', "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'");
  ensureColumn(db, 'chat_files', 'updated_at', "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'");
  ensureColumn(db, 'chat_files', 'is_project', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'chat_files', 'project_summary', 'TEXT');
  ensureColumn(db, 'chat_files', 'project_root_in_archive', 'TEXT');
  ensureColumn(db, 'chat_files', 'applied_at', 'TEXT');
  ensureColumn(db, 'chat_files', 'apply_error', 'TEXT');
  ensureColumn(db, 'chat_files', 'archive_entry_count', 'INTEGER');
  ensureColumn(db, 'chat_files', 'has_remote_manifest', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'chat_files', 'remote_manifest_project_id', 'TEXT');
  ensureColumn(db, 'chat_files', 'remote_manifest_status', 'TEXT');
  ensureColumn(db, 'chat_files', 'git_bundle_json', 'TEXT');
  ensureColumn(db, 'chat_file_archive_entries', 'crc32', 'INTEGER');
  ensureColumn(db, 'project_bundle', 'size_bytes', 'INTEGER');
  ensureColumn(db, 'project_bundle', 'file_count', 'INTEGER NOT NULL DEFAULT 0');
}

function ensureColumn(db: Database, tableName: string, columnName: string, columnDefinition: string): void {
  const statement = db.prepare(`PRAGMA table_info(${tableName});`);

  try {
    while (statement.step()) {
      const row = statement.getAsObject();
      if (cleanupText(row.name) === columnName) {
        return;
      }
    }
  } finally {
    statement.free();
  }

  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
}

async function openDatabase(dbPath: string): Promise<Database> {
  const SQL = await getSql();
  if (!existsSync(dbPath)) {
    return new SQL.Database();
  }

  return new SQL.Database(readFileSync(dbPath));
}

function saveDatabase(db: Database, dbPath: string): void {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, Buffer.from(db.export()));
}

async function withWritableDatabase<T>(folderPath: string, operation: (db: Database) => T): Promise<T> {
  const dbPath = resolveProjectMetaDbPath(folderPath);
  const db = await openDatabase(dbPath);

  try {
    initializeSchema(db);
    const result = operation(db);
    saveDatabase(db, dbPath);
    return result;
  } finally {
    db.close();
  }
}

async function withExistingDatabase<T>(folderPath: string, operation: (db: Database) => T): Promise<T | null> {
  const dbPath = resolveProjectMetaDbPath(folderPath);
  if (!existsSync(dbPath)) {
    return null;
  }

  const db = await openDatabase(dbPath);

  try {
    initializeSchema(db);
    return operation(db);
  } finally {
    db.close();
  }
}

export function resolveProjectMetaDbPath(folderPath: string): string {
  return path.join(folderPath, META_DIRECTORY_NAME, META_DB_NAME);
}

export async function ensureProjectMetaDb(identity: ProjectMetaIdentity): Promise<string> {
  await withWritableDatabase(identity.folderPath, (db) => {
    const statement = db.prepare(`
      INSERT INTO project_meta (project_id, project_name, folder_path, source_url, project_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        project_name = excluded.project_name,
        folder_path = excluded.folder_path,
        source_url = excluded.source_url,
        project_url = excluded.project_url,
        updated_at = excluded.updated_at;
    `);

    statement.run([
      identity.projectId,
      identity.projectName,
      identity.folderPath,
      identity.projectUrl,
      identity.projectUrl,
      new Date().toISOString(),
    ]);
    statement.free();

    const backfill = db.prepare(`
      UPDATE chats
      SET project_name = ?
      WHERE project_id = ?;
    `);
    backfill.run([identity.projectName, identity.projectId]);
    backfill.free();
  });

  return resolveProjectMetaDbPath(identity.folderPath);
}

export async function upsertProjectChat(folderPath: string, chat: ProjectChatUpsertInput): Promise<void> {
  await withWritableDatabase(folderPath, (db) => {
    const statement = db.prepare(`
      INSERT INTO chats (chat_id, chat_name, project_id, project_name, source_url, chat_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        chat_name = excluded.chat_name,
        project_id = excluded.project_id,
        project_name = excluded.project_name,
        source_url = excluded.source_url,
        chat_url = excluded.chat_url,
        updated_at = excluded.updated_at;
    `);

    statement.run([chat.chatId, chat.chatName, chat.projectId, chat.projectName, chat.chatUrl, chat.chatUrl, chat.updatedAt]);
    statement.free();
  });
}

export async function listProjectChats(folderPath: string): Promise<ProjectChatRecord[]> {
  return (
    (await withExistingDatabase(folderPath, (db) => {
      const statement = db.prepare(`
        SELECT chat_id, chat_name, project_id, project_name, source_url, chat_url, updated_at
        FROM chats
        ORDER BY updated_at DESC, chat_name COLLATE NOCASE ASC;
      `);

      const chats: ProjectChatRecord[] = [];
      while (statement.step()) {
        const row = statement.getAsObject();
        const chatId = cleanupText(row.chat_id);
        const chatName = cleanupText(row.chat_name);
        const projectId = cleanupText(row.project_id);
        const updatedAt = cleanupText(row.updated_at) || new Date(0).toISOString();

        if (!chatId || !chatName || !projectId) {
          continue;
        }

        chats.push({
          chatId,
          chatName,
          projectId,
          projectName: normalizeNullableText(row.project_name),
          chatUrl: normalizeNullableText(row.chat_url) ?? normalizeNullableText(row.source_url),
          updatedAt,
        });
      }

      statement.free();
      return chats;
    })) ?? []
  );
}



export async function upsertChatFile(folderPath: string, file: ProjectChatFileUpsertInput): Promise<void> {
  await withWritableDatabase(folderPath, (db) => {
    const statement = db.prepare(`
      INSERT INTO chat_files (
        chat_id,
        message_id,
        sandbox_path,
        project_id,
        project_name,
        download_url,
        download,
        file_name,
        discovered_at,
        updated_at,
        is_project,
        project_summary,
        project_root_in_archive,
        applied_at,
        apply_error,
        archive_entry_count,
        has_remote_manifest,
        remote_manifest_project_id,
        remote_manifest_status,
        git_bundle_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id, message_id, sandbox_path) DO UPDATE SET
        project_id = excluded.project_id,
        project_name = COALESCE(excluded.project_name, chat_files.project_name),
        download_url = COALESCE(excluded.download_url, chat_files.download_url),
        download = COALESCE(excluded.download, chat_files.download),
        file_name = COALESCE(excluded.file_name, chat_files.file_name),
        discovered_at = CASE
          WHEN chat_files.discovered_at IS NOT NULL AND chat_files.discovered_at != '' THEN chat_files.discovered_at
          ELSE excluded.discovered_at
        END,
        updated_at = excluded.updated_at,
        is_project = excluded.is_project,
        project_summary = excluded.project_summary,
        project_root_in_archive = excluded.project_root_in_archive,
        applied_at = excluded.applied_at,
        apply_error = excluded.apply_error,
        archive_entry_count = excluded.archive_entry_count,
        has_remote_manifest = excluded.has_remote_manifest,
        remote_manifest_project_id = excluded.remote_manifest_project_id,
        remote_manifest_status = excluded.remote_manifest_status,
        git_bundle_json = excluded.git_bundle_json;
    `);

    statement.run([
      file.chatId,
      file.messageId,
      file.sandboxPath,
      file.projectId,
      file.projectName,
      file.downloadUrl,
      file.downloadPath,
      file.fileName,
      file.discoveredAt,
      file.updatedAt,
      file.isProject ? 1 : 0,
      file.projectSummary ?? null,
      file.projectRootInArchive ?? null,
      file.appliedAt ?? null,
      file.applyError ?? null,
      file.archiveEntryCount ?? null,
      file.hasRemoteManifest ? 1 : 0,
      file.remoteManifestProjectId ?? null,
      file.remoteManifestStatus ?? null,
      file.gitBundle ? JSON.stringify(file.gitBundle) : null,
    ]);
    statement.free();
  });
}

export async function replaceChatFileArchiveEntries(
  folderPath: string,
  chatId: string,
  messageId: string,
  sandboxPath: string,
  entries: ProjectChatFileArchiveEntryUpsertInput[],
): Promise<void> {
  await withWritableDatabase(folderPath, (db) => {
    const deleteStatement = db.prepare(`
      DELETE FROM chat_file_archive_entries
      WHERE chat_id = ? AND message_id = ? AND sandbox_path = ?;
    `);
    deleteStatement.run([chatId, messageId, sandboxPath]);
    deleteStatement.free();

    if (!entries.length) {
      return;
    }

    const insertStatement = db.prepare(`
      INSERT INTO chat_file_archive_entries (
        chat_id,
        message_id,
        sandbox_path,
        relative_path,
        kind,
        size_bytes,
        crc32
      )
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `);

    for (const entry of entries) {
      insertStatement.run([
        entry.chatId,
        entry.messageId,
        entry.sandboxPath,
        entry.relativePath,
        entry.kind,
        entry.sizeBytes,
        entry.crc32 ?? null,
      ]);
    }

    insertStatement.free();
  });
}

function parseGitBundleInspection(value: unknown): GitBundleInspection | null {
  const rawJson = cleanupText(value);
  if (!rawJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawJson) as GitBundleInspection;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeRemoteManifestStatus(value: unknown): RemoteManifestStatus | null {
  const normalized = cleanupText(value);
  return normalized === 'missing' || normalized === 'matched' || normalized === 'mismatched' || normalized === 'invalid'
    ? normalized
    : null;
}

function mapChatFileRow(row: Record<string, unknown>): ChatFileRecord | null {
  const normalizedChatId = cleanupText(row.chat_id);
  const normalizedMessageId = cleanupText(row.message_id);
  const normalizedSandboxPath = cleanupText(row.sandbox_path);
  const normalizedProjectId = cleanupText(row.project_id);
  const discoveredAt = ensureIsoTimestamp(row.discovered_at);
  const updatedAt = ensureIsoTimestamp(row.updated_at);
  const appliedAt = ensureIsoTimestamp(row.applied_at);
  const downloadPath = normalizeNullableText(row.download);
  const archiveEntryCountRaw = row.archive_entry_count;
  const archiveEntryCount = archiveEntryCountRaw == null || archiveEntryCountRaw === '' ? null : Number(archiveEntryCountRaw);

  if (!normalizedChatId || !normalizedMessageId || !normalizedSandboxPath || !normalizedProjectId || !discoveredAt || !updatedAt) {
    return null;
  }

  return {
    projectId: normalizedProjectId,
    projectName: normalizeNullableText(row.project_name),
    chatId: normalizedChatId,
    messageId: normalizedMessageId,
    sandboxPath: normalizedSandboxPath,
    downloadUrl: normalizeNullableText(row.download_url),
    downloadPath,
    fileName: normalizeNullableText(row.file_name),
    sizeBytes: resolveFileSize(downloadPath),
    discoveredAt,
    updatedAt,
    isProject: Number(row.is_project) === 1,
    projectSummary: normalizeNullableText(row.project_summary),
    projectRootInArchive: normalizeNullableText(row.project_root_in_archive),
    appliedAt,
    applyError: normalizeNullableText(row.apply_error),
    archiveEntryCount: archiveEntryCount != null && Number.isFinite(archiveEntryCount) && archiveEntryCount >= 0 ? archiveEntryCount : null,
    hasRemoteManifest: Number(row.has_remote_manifest) === 1,
    remoteManifestProjectId: normalizeNullableText(row.remote_manifest_project_id),
    remoteManifestStatus: normalizeRemoteManifestStatus(row.remote_manifest_status),
    gitBundle: parseGitBundleInspection(row.git_bundle_json),
  };
}

export async function getChatFile(
  folderPath: string,
  chatId: string,
  messageId: string,
  sandboxPath: string,
): Promise<ChatFileRecord | null> {
  return (
    (await withExistingDatabase(folderPath, (db) => {
      const statement = db.prepare(`
        SELECT
          project_id,
          project_name,
          chat_id,
          message_id,
          sandbox_path,
          download_url,
          download,
          file_name,
          discovered_at,
          updated_at,
          is_project,
          project_summary,
          project_root_in_archive,
          applied_at,
          apply_error,
          archive_entry_count,
          has_remote_manifest,
          remote_manifest_project_id,
          remote_manifest_status,
          git_bundle_json
        FROM chat_files
        WHERE chat_id = ? AND message_id = ? AND sandbox_path = ?
        LIMIT 1;
      `);

      try {
        const bindableStatement = statement as typeof statement & {
          bind?: (values: unknown[] | Record<string, unknown>) => void;
        };
        bindableStatement.bind?.([chatId, messageId, sandboxPath]);
        if (!statement.step()) {
          return null;
        }

        return mapChatFileRow(statement.getAsObject() as Record<string, unknown>);
      } finally {
        statement.free();
      }
    })) ?? null
  );
}

function listChatFilesFromDatabase(db: Database, chatId: string): ChatFileRecord[] {
  const statement = db.prepare(`
    SELECT
      project_id,
      project_name,
      chat_id,
      message_id,
      sandbox_path,
      download_url,
      download,
      file_name,
      discovered_at,
      updated_at,
      is_project,
      project_summary,
      project_root_in_archive,
      applied_at,
      apply_error,
      archive_entry_count,
          has_remote_manifest,
          remote_manifest_project_id,
          remote_manifest_status,
          git_bundle_json
    FROM chat_files
    WHERE chat_id = ?
    ORDER BY updated_at DESC, sandbox_path COLLATE NOCASE ASC;
  `);

  try {
    const bindableStatement = statement as typeof statement & {
      bind?: (values: unknown[] | Record<string, unknown>) => void;
    };
    bindableStatement.bind?.([chatId]);

    const files: ChatFileRecord[] = [];
    while (statement.step()) {
      const mappedFile = mapChatFileRow(statement.getAsObject() as Record<string, unknown>);
      if (mappedFile) {
        files.push(mappedFile);
      }
    }

    return files;
  } finally {
    statement.free();
  }
}

export async function listChatFiles(folderPath: string, chatId: string): Promise<ChatFileRecord[]> {
  return (await withExistingDatabase(folderPath, (db) => listChatFilesFromDatabase(db, chatId))) ?? [];
}

export async function listProjectFiles(folderPath: string): Promise<ChatFileRecord[]> {
  return (
    (await withExistingDatabase(folderPath, (db) => {
      const statement = db.prepare(`
        SELECT
          project_id,
          project_name,
          chat_id,
          message_id,
          sandbox_path,
          download_url,
          download,
          file_name,
          discovered_at,
          updated_at,
          is_project,
          project_summary,
          project_root_in_archive,
          applied_at,
          apply_error,
          archive_entry_count,
          has_remote_manifest,
          remote_manifest_project_id,
          remote_manifest_status,
          git_bundle_json
        FROM chat_files
        ORDER BY updated_at DESC, sandbox_path COLLATE NOCASE ASC;
      `);

      const files: ChatFileRecord[] = [];
      while (statement.step()) {
        const mappedFile = mapChatFileRow(statement.getAsObject() as Record<string, unknown>);
        if (mappedFile) {
          files.push(mappedFile);
        }
      }

      statement.free();
      return files;
    })) ?? []
  );
}

export async function listChatFileArchiveEntries(
  folderPath: string,
  chatId: string,
  messageId: string,
  sandboxPath: string,
): Promise<ChatFileArchiveEntryRecord[]> {
  return (
    (await withExistingDatabase(folderPath, (db) => {
      const statement = db.prepare(`
        SELECT
          relative_path,
          kind,
          size_bytes,
          crc32
        FROM chat_file_archive_entries
        WHERE chat_id = ? AND message_id = ? AND sandbox_path = ?
        ORDER BY kind DESC, relative_path COLLATE NOCASE ASC;
      `);

      try {
        const bindableStatement = statement as typeof statement & {
          bind?: (values: unknown[] | Record<string, unknown>) => void;
        };
        bindableStatement.bind?.([chatId, messageId, sandboxPath]);

        const entries: ChatFileArchiveEntryRecord[] = [];
        while (statement.step()) {
          const row = statement.getAsObject();
          const relativePath = cleanupText(row.relative_path);
          const sizeBytes = Number(row.size_bytes);
          const kind = cleanupText(row.kind) === 'directory' ? 'directory' : 'file';
          const crc32Raw = row.crc32;
          const crc32 = crc32Raw == null || crc32Raw === '' ? null : Number(crc32Raw);
          if (!relativePath || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
            continue;
          }

          entries.push({
            relativePath,
            kind,
            sizeBytes,
            crc32: crc32 != null && Number.isFinite(crc32) ? crc32 >>> 0 : null,
          });
        }

        return entries;
      } finally {
        statement.free();
      }
    })) ?? []
  );
}

function listProjectBundleFilesFromDatabase(db: Database, projectId: string): ProjectBundleFileRecord[] {
  const statement = db.prepare(`
    SELECT
      relative_path,
      modified_at,
      size_bytes,
      sha256
    FROM project_bundle_files
    WHERE project_id = ?
    ORDER BY relative_path COLLATE NOCASE ASC;
  `);

  try {
    const bindableStatement = statement as typeof statement & {
      bind?: (values: unknown[] | Record<string, unknown>) => void;
    };
    bindableStatement.bind?.([projectId]);

    const files: ProjectBundleFileRecord[] = [];
    while (statement.step()) {
      const row = statement.getAsObject();
      const relativePath = cleanupText(row.relative_path);
      const modifiedAt = ensureIsoTimestamp(row.modified_at);
      const sizeBytes = Number(row.size_bytes);
      const sha256 = cleanupText(row.sha256).toLowerCase();

      if (!relativePath || !modifiedAt || !Number.isFinite(sizeBytes) || sizeBytes < 0 || !sha256) {
        continue;
      }

      files.push({
        relativePath,
        modifiedAt,
        sizeBytes,
        sha256,
      });
    }

    return files;
  } finally {
    statement.free();
  }
}

export async function getProjectBundle(folderPath: string): Promise<ProjectBundleRecord | null> {
  return (
    (await withExistingDatabase(folderPath, (db) => {
      const statement = db.prepare(`
        SELECT
          project_id,
          bundle_path,
          created_at,
          size_bytes,
          file_count
        FROM project_bundle
        LIMIT 1;
      `);

      try {
        if (!statement.step()) {
          return null;
        }

        const row = statement.getAsObject();
        const projectId = cleanupText(row.project_id);
        const bundlePath = cleanupText(row.bundle_path);
        const createdAt = ensureIsoTimestamp(row.created_at);
        const sizeBytesRaw = row.size_bytes;
        const sizeBytes = sizeBytesRaw == null || sizeBytesRaw === '' ? null : Number(sizeBytesRaw);
        const fileCount = Number(row.file_count);

        if (!projectId || !bundlePath || !createdAt) {
          return null;
        }

        const files = listProjectBundleFilesFromDatabase(db, projectId);

        return {
          projectId,
          bundlePath,
          createdAt,
          sizeBytes: sizeBytes != null && Number.isFinite(sizeBytes) && sizeBytes >= 0 ? sizeBytes : null,
          fileCount: Number.isFinite(fileCount) && fileCount >= 0 ? fileCount : files.length,
          files,
        };
      } finally {
        statement.free();
      }
    })) ?? null
  );
}

export async function upsertProjectBundle(folderPath: string, bundle: ProjectBundleUpsertInput): Promise<void> {
  await withWritableDatabase(folderPath, (db) => {
    const upsertStatement = db.prepare(`
      INSERT INTO project_bundle (
        project_id,
        bundle_path,
        created_at,
        size_bytes,
        file_count
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        bundle_path = excluded.bundle_path,
        created_at = excluded.created_at,
        size_bytes = excluded.size_bytes,
        file_count = excluded.file_count;
    `);

    upsertStatement.run([
      bundle.projectId,
      bundle.bundlePath,
      bundle.createdAt,
      bundle.sizeBytes,
      bundle.files.length,
    ]);
    upsertStatement.free();

    const deleteFilesStatement = db.prepare(`
      DELETE FROM project_bundle_files
      WHERE project_id = ?;
    `);
    deleteFilesStatement.run([bundle.projectId]);
    deleteFilesStatement.free();

    const insertFileStatement = db.prepare(`
      INSERT INTO project_bundle_files (
        project_id,
        relative_path,
        modified_at,
        size_bytes,
        sha256
      )
      VALUES (?, ?, ?, ?, ?);
    `);

    for (const file of bundle.files) {
      insertFileStatement.run([
        bundle.projectId,
        file.relativePath,
        file.modifiedAt,
        file.sizeBytes,
        file.sha256,
      ]);
    }

    insertFileStatement.free();
  });
}

export async function upsertChatHistory(folderPath: string, history: ProjectChatHistoryUpsertInput): Promise<void> {
  await withWritableDatabase(folderPath, (db) => {
    const serializedMessages = JSON.stringify(
      history.messages.map((message) => ({
        messageId: message.messageId,
        role: message.role,
        text: message.text,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        contentType: message.contentType ?? null,
        reasoning: message.reasoning ?? null,
      })),
    );

    const statement = db.prepare(`
      INSERT INTO chat_history (
        chat_id,
        project_id,
        project_name,
        chat_name,
        message_count,
        search_text,
        history_json,
        updated_at,
        captured_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        project_id = excluded.project_id,
        project_name = excluded.project_name,
        chat_name = excluded.chat_name,
        message_count = excluded.message_count,
        search_text = excluded.search_text,
        history_json = excluded.history_json,
        updated_at = excluded.updated_at,
        captured_at = excluded.captured_at;
    `);

    statement.run([
      history.chatId,
      history.projectId,
      history.projectName,
      history.chatName,
      history.messageCount,
      history.searchText,
      serializedMessages,
      history.updatedAt,
      history.capturedAt,
    ]);
    statement.free();
  });
}

export async function deleteChatArtifacts(folderPath: string, chatId: string): Promise<void> {
  await withWritableDatabase(folderPath, (db) => {
    const deleteChatStatement = db.prepare(`
      DELETE FROM chats
      WHERE chat_id = ?;
    `);
    deleteChatStatement.run([chatId]);
    deleteChatStatement.free();

    const deleteHistoryStatement = db.prepare(`
      DELETE FROM chat_history
      WHERE chat_id = ?;
    `);
    deleteHistoryStatement.run([chatId]);
    deleteHistoryStatement.free();

    const deleteFilesStatement = db.prepare(`
      DELETE FROM chat_files
      WHERE chat_id = ?;
    `);
    deleteFilesStatement.run([chatId]);
    deleteFilesStatement.free();
  });
}

export async function getChatHistory(folderPath: string, chatId: string): Promise<ChatHistoryRecord | null> {
  return (
    (await withExistingDatabase(folderPath, (db) => {
      const statement = db.prepare(`
        SELECT
          chat_id,
          project_id,
          project_name,
          chat_name,
          message_count,
          search_text,
          history_json,
          updated_at,
          captured_at
        FROM chat_history
        WHERE chat_id = ?
        LIMIT 1;
      `);

      try {
        const bindableStatement = statement as typeof statement & {
          bind?: (values: unknown[] | Record<string, unknown>) => void;
        };
        bindableStatement.bind?.([chatId]);
        if (!statement.step()) {
          return null;
        }

        const row = statement.getAsObject();
        const normalizedChatId = cleanupText(row.chat_id);
        const normalizedProjectId = cleanupText(row.project_id);
        const capturedAt = ensureIsoTimestamp(row.captured_at);

        if (!normalizedChatId || !normalizedProjectId || !capturedAt) {
          return null;
        }

        const rawMessages = (() => {
          try {
            return JSON.parse(typeof row.history_json === 'string' ? row.history_json : '[]') as unknown;
          } catch {
            return [];
          }
        })();
        const messages = Array.isArray(rawMessages)
          ? rawMessages.map((entry) => normalizeHistoryMessageRecord(entry)).filter((entry): entry is ChatHistoryMessageRecord => Boolean(entry))
          : [];
        const files = listChatFilesFromDatabase(db, normalizedChatId);

        return {
          chatId: normalizedChatId,
          projectId: normalizedProjectId,
          projectName: normalizeNullableText(row.project_name),
          chatName: normalizeNullableText(row.chat_name),
          messageCount: Number.isFinite(Number(row.message_count)) ? Number(row.message_count) : messages.length,
          messages,
          files,
          searchText: cleanupText(row.search_text),
          updatedAt: ensureIsoTimestamp(row.updated_at),
          capturedAt,
        };
      } finally {
        statement.free();
      }
    })) ?? null
  );
}
