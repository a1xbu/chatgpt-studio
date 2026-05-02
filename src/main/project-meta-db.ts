import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import {
  ChatFileArchiveEntryRecord,
  ChatFileRecord,
  GitBundleInspection,
  ChatHistoryMessageRecord,
  ChatHistoryMessageRole,
  ChatHistoryMultimodalPart,
  ChatHistoryReasoningStep,
  ChatHistoryReasoningSummary,
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
  isPartial?: boolean;
  currentNode?: string | null;
  snapshotJson?: string | null;
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
      current_node TEXT,
      snapshot_json TEXT,
      updated_at TEXT,
      captured_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON chat_history(project_id);

    CREATE TABLE IF NOT EXISTS chat_messages (
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      parent_message_id TEXT,
      turn_id TEXT,
      role TEXT NOT NULL,
      author_name TEXT,
      model_slug TEXT,
      node_id TEXT,
      content_type TEXT,
      message_type TEXT,
      language TEXT,
      text TEXT NOT NULL,
      parts_json TEXT,
      children_json TEXT,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      end_turn INTEGER,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      reasoning_recap TEXT,
      reasoning_duration_sec REAL,
      reasoning_started_at TEXT,
      reasoning_ended_at TEXT,
      PRIMARY KEY (chat_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_position ON chat_messages(chat_id, position);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_turn ON chat_messages(chat_id, turn_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_parent ON chat_messages(chat_id, parent_message_id);

    CREATE TABLE IF NOT EXISTS chat_message_thoughts (
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      summary TEXT,
      content TEXT NOT NULL,
      chunks_json TEXT,
      PRIMARY KEY (chat_id, message_id, step_index)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_message_thoughts_msg ON chat_message_thoughts(chat_id, message_id);

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
  ensureColumn(db, 'chat_history', 'current_node', 'TEXT');
  ensureColumn(db, 'chat_history', 'snapshot_json', 'TEXT');
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
  ensureColumn(db, 'chat_messages', 'parts_json', 'TEXT');
  ensureColumn(db, 'chat_messages', 'children_json', 'TEXT');
  ensureColumn(db, 'chat_messages', 'author_name', 'TEXT');
  ensureColumn(db, 'chat_messages', 'model_slug', 'TEXT');
  ensureColumn(db, 'chat_messages', 'node_id', 'TEXT');
  ensureColumn(db, 'chat_messages', 'reasoning_started_at', 'TEXT');
  ensureColumn(db, 'chat_messages', 'reasoning_ended_at', 'TEXT');
  ensureColumn(db, 'chat_messages', 'reasoning_duration_sec', 'REAL');
  ensureColumn(db, 'chat_messages', 'reasoning_recap', 'TEXT');
  ensureColumn(db, 'chat_messages', 'language', 'TEXT');
  ensureColumn(db, 'chat_messages', 'message_type', 'TEXT');
  ensureColumn(db, 'chat_messages', 'turn_id', 'TEXT');
  ensureColumn(db, 'chat_messages', 'parent_message_id', 'TEXT');
  ensureColumn(db, 'chat_messages', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'chat_messages', 'end_turn', 'INTEGER');
  ensureColumn(db, 'chat_messages', 'status', 'TEXT');
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

function buildSyntheticMessageId(chatId: string, position: number): string {
  return `__synthetic__::${chatId}::${String(position).padStart(6, '0')}`;
}

function isSyntheticMessageId(messageId: string | null): boolean {
  return typeof messageId === 'string' && messageId.startsWith('__synthetic__::');
}

function serializeMessageParts(parts: ChatHistoryMultimodalPart[] | null | undefined): string | null {
  if (!parts || !parts.length) {
    return null;
  }

  try {
    return JSON.stringify(parts);
  } catch {
    return null;
  }
}

function serializeStringListJson(values: readonly string[] | null | undefined): string | null {
  if (!values) {
    return null;
  }

  try {
    return JSON.stringify(values);
  } catch {
    return null;
  }
}

function readMaxPosition(db: Database, chatId: string): number {
  const statement = db.prepare('SELECT COALESCE(MAX(position), -1) AS max_pos FROM chat_messages WHERE chat_id = ?;');
  try {
    (statement as typeof statement & { bind?: (values: unknown[]) => void }).bind?.([chatId]);
    if (!statement.step()) {
      return -1;
    }
    const row = statement.getAsObject() as Record<string, unknown>;
    const value = Number(row.max_pos);
    return Number.isFinite(value) ? value : -1;
  } finally {
    statement.free();
  }
}

function readExistingMessagePosition(db: Database, chatId: string, messageId: string): number | null {
  const statement = db.prepare('SELECT position FROM chat_messages WHERE chat_id = ? AND message_id = ?;');
  try {
    (statement as typeof statement & { bind?: (values: unknown[]) => void }).bind?.([chatId, messageId]);
    if (!statement.step()) {
      return null;
    }
    const row = statement.getAsObject() as Record<string, unknown>;
    const value = Number(row.position);
    return Number.isFinite(value) ? value : null;
  } finally {
    statement.free();
  }
}

export async function upsertChatHistory(folderPath: string, history: ProjectChatHistoryUpsertInput): Promise<void> {
  await withWritableDatabase(folderPath, (db) => {
    const isPartial = history.isPartial === true;
    db.run('BEGIN');
    try {
      // chat_history meta. For partial updates, preserve previously stored snapshot_json
      // and current_node so streaming never wipes the canonical snapshot.
      const historyStatement = db.prepare(`
        INSERT INTO chat_history (
          chat_id,
          project_id,
          project_name,
          chat_name,
          message_count,
          search_text,
          current_node,
          snapshot_json,
          updated_at,
          captured_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          project_id = excluded.project_id,
          project_name = COALESCE(excluded.project_name, chat_history.project_name),
          chat_name = COALESCE(excluded.chat_name, chat_history.chat_name),
          message_count = MAX(excluded.message_count, chat_history.message_count),
          search_text = COALESCE(NULLIF(excluded.search_text, ''), chat_history.search_text),
          current_node = COALESCE(excluded.current_node, chat_history.current_node),
          snapshot_json = CASE
            WHEN excluded.snapshot_json IS NOT NULL AND excluded.snapshot_json != '' THEN excluded.snapshot_json
            ELSE chat_history.snapshot_json
          END,
          updated_at = COALESCE(excluded.updated_at, chat_history.updated_at),
          captured_at = excluded.captured_at;
      `);

      historyStatement.run([
        history.chatId,
        history.projectId,
        history.projectName,
        history.chatName,
        history.messageCount,
        history.searchText,
        history.currentNode ?? null,
        isPartial ? null : history.snapshotJson ?? null,
        history.updatedAt,
        history.capturedAt,
      ]);
      historyStatement.free();

      if (!isPartial) {
        const deleteMessages = db.prepare('DELETE FROM chat_messages WHERE chat_id = ?;');
        deleteMessages.run([history.chatId]);
        deleteMessages.free();

        const deleteThoughts = db.prepare('DELETE FROM chat_message_thoughts WHERE chat_id = ?;');
        deleteThoughts.run([history.chatId]);
        deleteThoughts.free();
      }

      const insertMessage = db.prepare(`
        INSERT INTO chat_messages (
          chat_id,
          message_id,
          position,
          parent_message_id,
          turn_id,
          role,
          author_name,
          model_slug,
          node_id,
          content_type,
          message_type,
          language,
          text,
          parts_json,
          children_json,
          is_hidden,
          end_turn,
          status,
          created_at,
          updated_at,
          reasoning_recap,
          reasoning_duration_sec,
          reasoning_started_at,
          reasoning_ended_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(chat_id, message_id) DO UPDATE SET
          position = excluded.position,
          parent_message_id = COALESCE(excluded.parent_message_id, chat_messages.parent_message_id),
          turn_id = COALESCE(excluded.turn_id, chat_messages.turn_id),
          role = CASE WHEN excluded.role = 'unknown' THEN chat_messages.role ELSE excluded.role END,
          author_name = COALESCE(excluded.author_name, chat_messages.author_name),
          model_slug = COALESCE(excluded.model_slug, chat_messages.model_slug),
          node_id = COALESCE(excluded.node_id, chat_messages.node_id),
          content_type = COALESCE(excluded.content_type, chat_messages.content_type),
          message_type = COALESCE(excluded.message_type, chat_messages.message_type),
          language = COALESCE(excluded.language, chat_messages.language),
          text = CASE WHEN length(excluded.text) >= length(chat_messages.text) THEN excluded.text ELSE chat_messages.text END,
          parts_json = COALESCE(excluded.parts_json, chat_messages.parts_json),
          children_json = COALESCE(excluded.children_json, chat_messages.children_json),
          is_hidden = excluded.is_hidden,
          end_turn = COALESCE(excluded.end_turn, chat_messages.end_turn),
          status = COALESCE(excluded.status, chat_messages.status),
          created_at = COALESCE(excluded.created_at, chat_messages.created_at),
          updated_at = COALESCE(excluded.updated_at, chat_messages.updated_at),
          reasoning_recap = COALESCE(excluded.reasoning_recap, chat_messages.reasoning_recap),
          reasoning_duration_sec = COALESCE(excluded.reasoning_duration_sec, chat_messages.reasoning_duration_sec),
          reasoning_started_at = COALESCE(excluded.reasoning_started_at, chat_messages.reasoning_started_at),
          reasoning_ended_at = COALESCE(excluded.reasoning_ended_at, chat_messages.reasoning_ended_at);
      `);

      const deleteThoughtsForMessage = db.prepare(
        'DELETE FROM chat_message_thoughts WHERE chat_id = ? AND message_id = ?;',
      );

      const insertThought = db.prepare(`
        INSERT INTO chat_message_thoughts (
          chat_id,
          message_id,
          step_index,
          summary,
          content,
          chunks_json
        )
        VALUES (?, ?, ?, ?, ?, ?);
      `);

      const seenMessageIds = new Set<string>();
      let nextPosition = isPartial ? readMaxPosition(db, history.chatId) + 1 : 0;
      let appendedFromInput = 0;
      for (const message of history.messages) {
        const explicitMessageId = normalizeNullableText(message.messageId);
        let messageId = explicitMessageId;
        if (!messageId || seenMessageIds.has(messageId)) {
          messageId = buildSyntheticMessageId(history.chatId, nextPosition + appendedFromInput);
        }
        seenMessageIds.add(messageId);

        let position: number;
        if (isPartial) {
          const existingPos = readExistingMessagePosition(db, history.chatId, messageId);
          if (existingPos !== null) {
            position = existingPos;
          } else {
            position = nextPosition + appendedFromInput;
            appendedFromInput += 1;
          }
        } else {
          position = nextPosition;
          nextPosition += 1;
        }

        insertMessage.run([
          history.chatId,
          messageId,
          position,
          normalizeNullableText(message.parentMessageId),
          normalizeNullableText(message.turnId),
          message.role,
          normalizeNullableText(message.authorName),
          normalizeNullableText(message.modelSlug),
          normalizeNullableText(message.nodeId),
          normalizeNullableText(message.contentType),
          normalizeNullableText(message.messageType),
          normalizeNullableText(message.language),
          message.text,
          serializeMessageParts(message.parts),
          serializeStringListJson(message.children),
          message.isHidden ? 1 : 0,
          message.endTurn === true ? 1 : message.endTurn === false ? 0 : null,
          normalizeNullableText(message.status),
          ensureIsoTimestamp(message.createdAt),
          ensureIsoTimestamp(message.updatedAt),
          message.reasoning ? message.reasoning.recap : null,
          message.reasoning && message.reasoning.finishedDurationSec != null
            ? message.reasoning.finishedDurationSec
            : null,
          message.reasoning ? ensureIsoTimestamp(message.reasoning.startedAt) : null,
          message.reasoning ? ensureIsoTimestamp(message.reasoning.endedAt) : null,
        ]);

        if (message.reasoning?.steps?.length) {
          deleteThoughtsForMessage.run([history.chatId, messageId]);
          let stepIndex = 0;
          for (const step of message.reasoning.steps) {
            const chunksJson = step.chunks?.length ? JSON.stringify(step.chunks) : null;
            insertThought.run([
              history.chatId,
              messageId,
              stepIndex,
              step.summary ?? null,
              step.content,
              chunksJson,
            ]);
            stepIndex += 1;
          }
        }
      }

      insertMessage.free();
      insertThought.free();
      deleteThoughtsForMessage.free();

      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
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

    const deleteMessagesStatement = db.prepare(`
      DELETE FROM chat_messages
      WHERE chat_id = ?;
    `);
    deleteMessagesStatement.run([chatId]);
    deleteMessagesStatement.free();

    const deleteThoughtsStatement = db.prepare(`
      DELETE FROM chat_message_thoughts
      WHERE chat_id = ?;
    `);
    deleteThoughtsStatement.run([chatId]);
    deleteThoughtsStatement.free();
  });
}

function parseStringListJson(value: unknown): string[] | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .map((entry) => (typeof entry === 'string' ? cleanupText(entry) : ''))
      .filter((entry): entry is string => Boolean(entry));
  } catch {
    return null;
  }
}

function parseMessagePartsJson(value: unknown): ChatHistoryMultimodalPart[] | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const parts: ChatHistoryMultimodalPart[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const candidate = entry as Record<string, unknown>;
      const kind = candidate.kind === 'image' || candidate.kind === 'attachment' || candidate.kind === 'text'
        ? candidate.kind
        : 'unknown';
      parts.push({
        kind,
        text: typeof candidate.text === 'string' ? candidate.text : null,
        assetPointer: typeof candidate.assetPointer === 'string' ? candidate.assetPointer : null,
        mimeType: typeof candidate.mimeType === 'string' ? candidate.mimeType : null,
        width: typeof candidate.width === 'number' ? candidate.width : null,
        height: typeof candidate.height === 'number' ? candidate.height : null,
      });
    }
    return parts.length ? parts : null;
  } catch {
    return null;
  }
}

function listChatMessagesFromDatabase(
  db: Database,
  chatId: string,
  options: { includeThoughts?: boolean } = {},
): ChatHistoryMessageRecord[] {
  const includeThoughts = options.includeThoughts === true;
  const statement = db.prepare(`
    SELECT
      message_id,
      position,
      parent_message_id,
      turn_id,
      role,
      author_name,
      model_slug,
      node_id,
      content_type,
      message_type,
      language,
      text,
      parts_json,
      children_json,
      is_hidden,
      end_turn,
      status,
      created_at,
      updated_at,
      reasoning_recap,
      reasoning_duration_sec,
      reasoning_started_at,
      reasoning_ended_at
    FROM chat_messages
    WHERE chat_id = ?
    ORDER BY position ASC;
  `);

  const messages: ChatHistoryMessageRecord[] = [];
  try {
    const bindableStatement = statement as typeof statement & {
      bind?: (values: unknown[] | Record<string, unknown>) => void;
    };
    bindableStatement.bind?.([chatId]);
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      const messageIdRaw = cleanupText(row.message_id);
      if (!messageIdRaw) {
        continue;
      }

      const role = isMessageRole(row.role) ? row.role : 'unknown';
      const recap = normalizeNullableText(row.reasoning_recap);
      const durationRaw = row.reasoning_duration_sec;
      const finishedDurationSec = typeof durationRaw === 'number' && Number.isFinite(durationRaw)
        ? durationRaw
        : durationRaw == null || durationRaw === '' ? null : Number(durationRaw);

      const reasoning: ChatHistoryReasoningSummary | null = recap
        ? {
            recap,
            finishedDurationSec: Number.isFinite(finishedDurationSec) ? Number(finishedDurationSec) : null,
            startedAt: ensureIsoTimestamp(row.reasoning_started_at),
            endedAt: ensureIsoTimestamp(row.reasoning_ended_at),
            steps: [],
            stepsLoaded: false,
          }
        : null;

      messages.push({
        messageId: isSyntheticMessageId(messageIdRaw) ? null : messageIdRaw,
        nodeId: normalizeNullableText(row.node_id),
        parentMessageId: normalizeNullableText(row.parent_message_id),
        turnId: normalizeNullableText(row.turn_id),
        role,
        authorName: normalizeNullableText(row.author_name),
        modelSlug: normalizeNullableText(row.model_slug),
        text: typeof row.text === 'string' ? row.text : '',
        createdAt: ensureIsoTimestamp(row.created_at),
        updatedAt: ensureIsoTimestamp(row.updated_at),
        contentType: normalizeNullableText(row.content_type),
        messageType: normalizeNullableText(row.message_type),
        language: normalizeNullableText(row.language),
        parts: parseMessagePartsJson(row.parts_json),
        children: parseStringListJson(row.children_json),
        isHidden: Number(row.is_hidden) === 1,
        endTurn: row.end_turn == null || row.end_turn === '' ? null : Number(row.end_turn) === 1,
        status: normalizeNullableText(row.status),
        reasoning,
      });
    }
  } finally {
    statement.free();
  }

  if (!includeThoughts) {
    return messages;
  }

  const thoughtsStatement = db.prepare(`
    SELECT message_id, step_index, summary, content, chunks_json
    FROM chat_message_thoughts
    WHERE chat_id = ?
    ORDER BY message_id, step_index ASC;
  `);

  try {
    const bindableStatement = thoughtsStatement as typeof thoughtsStatement & {
      bind?: (values: unknown[] | Record<string, unknown>) => void;
    };
    bindableStatement.bind?.([chatId]);

    const stepsByMessageId = new Map<string, ChatHistoryReasoningStep[]>();
    while (thoughtsStatement.step()) {
      const row = thoughtsStatement.getAsObject() as Record<string, unknown>;
      const messageId = cleanupText(row.message_id);
      const content = typeof row.content === 'string' ? row.content : '';
      if (!messageId || !content) {
        continue;
      }
      let chunks: string[] = [];
      if (typeof row.chunks_json === 'string' && row.chunks_json) {
        try {
          const parsed = JSON.parse(row.chunks_json);
          if (Array.isArray(parsed)) {
            chunks = parsed
              .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
              .filter((entry): entry is string => Boolean(entry));
          }
        } catch {
          chunks = [];
        }
      }

      const list = stepsByMessageId.get(messageId) ?? [];
      list.push({
        summary: normalizeNullableText(row.summary),
        content,
        chunks,
      });
      stepsByMessageId.set(messageId, list);
    }

    for (const message of messages) {
      const lookupId = message.messageId ?? null;
      if (!lookupId || !message.reasoning) {
        continue;
      }
      const steps = stepsByMessageId.get(lookupId);
      if (steps && steps.length) {
        message.reasoning.steps = steps;
        message.reasoning.stepsLoaded = true;
      }
    }
  } finally {
    thoughtsStatement.free();
  }

  return messages;
}

export async function getChatMessageThoughts(
  folderPath: string,
  chatId: string,
  messageId: string,
): Promise<ChatHistoryReasoningStep[]> {
  return (
    (await withExistingDatabase(folderPath, (db) => {
      const statement = db.prepare(`
        SELECT step_index, summary, content, chunks_json
        FROM chat_message_thoughts
        WHERE chat_id = ? AND message_id = ?
        ORDER BY step_index ASC;
      `);

      const steps: ChatHistoryReasoningStep[] = [];
      try {
        const bindableStatement = statement as typeof statement & {
          bind?: (values: unknown[] | Record<string, unknown>) => void;
        };
        bindableStatement.bind?.([chatId, messageId]);
        while (statement.step()) {
          const row = statement.getAsObject() as Record<string, unknown>;
          const content = typeof row.content === 'string' ? row.content : '';
          if (!content) {
            continue;
          }
          let chunks: string[] = [];
          if (typeof row.chunks_json === 'string' && row.chunks_json) {
            try {
              const parsed = JSON.parse(row.chunks_json);
              if (Array.isArray(parsed)) {
                chunks = parsed
                  .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
                  .filter((entry): entry is string => Boolean(entry));
              }
            } catch {
              chunks = [];
            }
          }
          steps.push({
            summary: normalizeNullableText(row.summary),
            content,
            chunks,
          });
        }
      } finally {
        statement.free();
      }
      return steps;
    })) ?? []
  );
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
          current_node,
          snapshot_json,
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

        const messages = listChatMessagesFromDatabase(db, normalizedChatId, { includeThoughts: true });
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
          currentNode: normalizeNullableText(row.current_node),
          snapshotJson: typeof row.snapshot_json === 'string' && row.snapshot_json.length > 0 ? row.snapshot_json : null,
        };
      } finally {
        statement.free();
      }
    })) ?? null
  );
}
