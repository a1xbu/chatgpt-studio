import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as pty from 'node-pty';

export interface TerminalSessionSnapshot {
  sessionId: string;
  cwd: string | null;
  shell: string;
}

interface TerminalOpenRequest {
  cols: number;
  rows: number;
  cwd: string | null;
}

interface TerminalCallbacks {
  onData: (payload: { sessionId: string; data: string }) => void;
  onExit: (payload: { sessionId: string; exitCode: number; signal?: number }) => void;
}

interface ActiveTerminalSession {
  process: pty.IPty;
  snapshot: TerminalSessionSnapshot;
}

function normalizeExistingDirectory(folderPath: string | null | undefined): string | undefined {
  if (!folderPath) {
    return undefined;
  }

  try {
    return existsSync(folderPath) && statSync(folderPath).isDirectory() ? folderPath : undefined;
  } catch {
    return undefined;
  }
}

function commandExists(command: string): boolean {
  const checker = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(checker, [command], {
    stdio: 'ignore',
    windowsHide: true,
  });

  return result.status === 0;
}

function resolveShellLaunch(): { command: string; args: string[]; label: string } {
  if (process.platform === 'win32') {
    if (commandExists('pwsh.exe')) {
      return { command: 'pwsh.exe', args: [], label: 'pwsh.exe' };
    }

    if (commandExists('powershell.exe')) {
      return { command: 'powershell.exe', args: [], label: 'powershell.exe' };
    }

    return { command: process.env.ComSpec || 'cmd.exe', args: [], label: process.env.ComSpec || 'cmd.exe' };
  }

  const envShell = process.env.SHELL;
  if (envShell) {
    return { command: envShell, args: ['-i'], label: envShell };
  }

  if (commandExists('bash')) {
    return { command: 'bash', args: ['-i'], label: 'bash' };
  }

  return { command: 'sh', args: ['-i'], label: 'sh' };
}

export class TerminalManager {
  private readonly sessions = new Map<string, ActiveTerminalSession>();

  public constructor(private readonly callbacks: TerminalCallbacks) {}

  public getSnapshots(): TerminalSessionSnapshot[] {
    return [...this.sessions.values()].map((session) => session.snapshot);
  }

  public open(request: TerminalOpenRequest): TerminalSessionSnapshot {
    const shellLaunch = resolveShellLaunch();
    const sessionId = `terminal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cwd = normalizeExistingDirectory(request.cwd) ?? undefined;
    const cols = Math.max(40, Math.floor(request.cols) || 80);
    const rows = Math.max(10, Math.floor(request.rows) || 24);

    const processOptions: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions =
      process.platform === 'win32'
        ? {
            name: 'xterm-256color',
            cols,
            rows,
            cwd,
            env: { ...process.env, TERM: 'xterm-256color' },
            useConpty: true,
          }
        : {
            name: 'xterm-256color',
            cols,
            rows,
            cwd,
            env: { ...process.env, TERM: 'xterm-256color' },
          };

    const terminalProcess = pty.spawn(shellLaunch.command, shellLaunch.args, processOptions);
    const snapshot: TerminalSessionSnapshot = {
      sessionId,
      cwd: cwd ?? null,
      shell: shellLaunch.label,
    };

    terminalProcess.onData((data) => {
      if (!this.sessions.has(sessionId)) {
        return;
      }

      this.callbacks.onData({ sessionId, data });
    });

    terminalProcess.onExit((event) => {
      if (!this.sessions.has(sessionId)) {
        return;
      }

      this.sessions.delete(sessionId);
      this.callbacks.onExit({
        sessionId,
        exitCode: event.exitCode,
        signal: event.signal,
      });
    });

    this.sessions.set(sessionId, {
      process: terminalProcess,
      snapshot,
    });

    return snapshot;
  }

  public write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.process.write(data);
  }

  public resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.process.resize(Math.max(2, Math.floor(cols) || 80), Math.max(1, Math.floor(rows) || 24));
  }

  public close(sessionId?: string): void {
    if (!sessionId) {
      for (const existingSessionId of [...this.sessions.keys()]) {
        this.close(existingSessionId);
      }
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(sessionId);

    try {
      session.process.kill();
    } catch {
      // Ignore teardown failures during PoC cleanup.
    }
  }
}
