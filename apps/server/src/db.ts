import Database from "better-sqlite3";
import path from "node:path";
import { config } from "./config.js";

export const db = new Database(path.join(config.dataDir, "words2site.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  prompt TEXT NOT NULL,
  transcript TEXT,
  status TEXT NOT NULL,           -- queued/generating/validating/done/published/failed
  stage TEXT,                     -- 人类可读的当前阶段说明
  codex_session_id TEXT,
  workdir TEXT,
  error TEXT,
  attempts INTEGER DEFAULT 0,
  refinements INTEGER DEFAULT 0,
  ip TEXT,
  device_id TEXT,
  html_size INTEGER,
  publish_url TEXT,
  email TEXT,
  domain TEXT,
  is_public INTEGER DEFAULT 1,
  removed_at INTEGER,
  screenshot INTEGER DEFAULT 0,     -- 0 无 1 有(data/tasks/<id>/shot.png)
  created_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_ip ON tasks(ip);

CREATE TABLE IF NOT EXISTS codex_sessions (
  session_id TEXT PRIMARY KEY,
  task_id TEXT,
  pid INTEGER,
  state TEXT NOT NULL,            -- spawning/generating/done/killed/failed
  workdir TEXT,
  started_at INTEGER,
  ended_at INTEGER
);
`);

// 旧库迁移:补齐新增列(SQLite 无 ADD COLUMN IF NOT EXISTS,逐个尝试)
for (const col of [
  "ALTER TABLE tasks ADD COLUMN email TEXT",
  "ALTER TABLE tasks ADD COLUMN domain TEXT",
  "ALTER TABLE tasks ADD COLUMN is_public INTEGER DEFAULT 1",
  "ALTER TABLE tasks ADD COLUMN removed_at INTEGER",
  "ALTER TABLE tasks ADD COLUMN screenshot INTEGER DEFAULT 0",
]) {
  try { db.prepare(col).run(); } catch { /* 已存在 */ }
}
// 依赖新列的唯一索引(须在迁移之后创建)
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_domain ON tasks(domain) WHERE domain IS NOT NULL AND removed_at IS NULL",
);

export interface TaskRow {
  id: string;
  code: string | null;
  prompt: string;
  transcript: string | null;
  status: string;
  stage: string | null;
  codex_session_id: string | null;
  workdir: string | null;
  error: string | null;
  attempts: number;
  refinements: number;
  ip: string | null;
  device_id: string | null;
  html_size: number | null;
  publish_url: string | null;
  email: string | null;
  domain: string | null;
  is_public: number;
  removed_at: number | null;
  screenshot: number;
  created_at: number;
  finished_at: number | null;
}

export interface SessionRow {
  session_id: string;
  task_id: string | null;
  pid: number | null;
  state: string;
  workdir: string | null;
  started_at: number;
  ended_at: number | null;
}

const stmts = {
  insertTask: db.prepare(`
    INSERT INTO tasks (id, prompt, transcript, status, ip, device_id, email, domain, is_public, created_at)
    VALUES (@id, @prompt, @transcript, 'queued', @ip, @device_id, @email, @domain, @is_public, @created_at)
  `),
  getTask: db.prepare("SELECT * FROM tasks WHERE id = ?"),
  getTaskByCode: db.prepare("SELECT * FROM tasks WHERE code = ?"),
  updateTask: db.prepare(`
    UPDATE tasks SET
      status = COALESCE(@status, status),
      stage = COALESCE(@stage, stage),
      codex_session_id = COALESCE(@codex_session_id, codex_session_id),
      workdir = COALESCE(@workdir, workdir),
      error = @error,
      attempts = COALESCE(@attempts, attempts),
      refinements = COALESCE(@refinements, refinements),
      html_size = COALESCE(@html_size, html_size),
      publish_url = COALESCE(@publish_url, publish_url),
      code = COALESCE(@code, code),
      is_public = COALESCE(@is_public, is_public),
      removed_at = COALESCE(@removed_at, removed_at),
      screenshot = COALESCE(@screenshot, screenshot),
      finished_at = COALESCE(@finished_at, finished_at)
    WHERE id = @id
  `),
  listByStatus: db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at"),
  listQueueAhead: db.prepare(
    "SELECT COUNT(*) AS n FROM tasks WHERE status = 'queued' AND created_at < ?",
  ),
  domainTaken: db.prepare(
    "SELECT COUNT(*) AS n FROM tasks WHERE domain = ? COLLATE NOCASE AND removed_at IS NULL",
  ),
  listScreen: db.prepare(`
    SELECT id, code, domain, prompt, publish_url, screenshot, created_at
    FROM tasks
    WHERE status = 'published' AND is_public = 1 AND removed_at IS NULL AND publish_url IS NOT NULL
    ORDER BY created_at DESC LIMIT 50
  `),
  listTasksPage: db.prepare(`
    SELECT * FROM tasks ORDER BY created_at DESC LIMIT @limit OFFSET @offset
  `),
  stats: db.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('queued','generating','validating')) AS active,
      COUNT(*) FILTER (WHERE status = 'done') AS done,
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      AVG(finished_at - created_at) FILTER (WHERE finished_at IS NOT NULL) AS avg_ms
    FROM tasks
  `),
  upsertSession: db.prepare(`
    INSERT INTO codex_sessions (session_id, task_id, pid, state, workdir, started_at)
    VALUES (@session_id, @task_id, @pid, @state, @workdir, @started_at)
    ON CONFLICT(session_id) DO UPDATE SET
      task_id = COALESCE(@task_id, task_id),
      pid = COALESCE(@pid, pid),
      state = @state,
      workdir = COALESCE(@workdir, workdir)
  `),
  updateSessionState: db.prepare(`
    UPDATE codex_sessions SET state = @state, ended_at = COALESCE(@ended_at, ended_at)
    WHERE session_id = @session_id
  `),
  listSessions: db.prepare("SELECT * FROM codex_sessions ORDER BY started_at DESC LIMIT 100"),
  getSession: db.prepare("SELECT * FROM codex_sessions WHERE session_id = ?"),
};

export const tasks = {
  create(p: {
    id: string;
    prompt: string;
    transcript: string | null;
    ip: string;
    deviceId: string;
    email: string;
    domain: string;
    isPublic: boolean;
  }) {
    stmts.insertTask.run({
      id: p.id,
      prompt: p.prompt,
      transcript: p.transcript,
      ip: p.ip,
      device_id: p.deviceId,
      email: p.email,
      domain: p.domain,
      is_public: p.isPublic ? 1 : 0,
      created_at: Date.now(),
    });
  },
  domainTaken(domain: string): boolean {
    return (stmts.domainTaken.get(domain) as { n: number }).n > 0;
  },
  listScreen(): Array<{ id: string; code: string | null; domain: string | null; prompt: string; publish_url: string | null; screenshot: number; created_at: number }> {
    return stmts.listScreen.all() as never;
  },
  get(id: string): TaskRow | undefined {
    return stmts.getTask.get(id) as TaskRow | undefined;
  },
  getByCode(code: string): TaskRow | undefined {
    return stmts.getTaskByCode.get(code) as TaskRow | undefined;
  },
  update(p: Partial<TaskRow> & { id: string }) {
    const base: Record<string, unknown> = {
      status: null,
      stage: null,
      codex_session_id: null,
      workdir: null,
      attempts: null,
      refinements: null,
      html_size: null,
      publish_url: null,
      code: null,
      is_public: null,
      removed_at: null,
      screenshot: null,
      finished_at: null,
      ...p,
    };
    base.error = p.error ?? null; // error 显式允许清空
    stmts.updateTask.run(base);
  },
  queuePosition(createdAt: number): number {
    return (stmts.listQueueAhead.get(createdAt) as { n: number }).n;
  },
  page(pageNo: number, pageSize = 50): TaskRow[] {
    return stmts.listTasksPage.all({
      limit: pageSize,
      offset: (pageNo - 1) * pageSize,
    }) as TaskRow[];
  },
  stats() {
    return stmts.stats.get() as {
      active: number;
      done: number;
      published: number;
      failed: number;
      avg_ms: number | null;
    };
  },
};

export const sessions = {
  upsert(p: { sessionId: string; taskId: string | null; pid: number | null; state: string; workdir: string | null }) {
    stmts.upsertSession.run({
      session_id: p.sessionId,
      task_id: p.taskId,
      pid: p.pid,
      state: p.state,
      workdir: p.workdir,
      started_at: Date.now(),
    });
  },
  setState(sessionId: string, state: string, ended = false) {
    stmts.updateSessionState.run({
      session_id: sessionId,
      state,
      ended_at: ended ? Date.now() : null,
    });
  },
  list(): SessionRow[] {
    return stmts.listSessions.all() as SessionRow[];
  },
  get(sessionId: string): SessionRow | undefined {
    return stmts.getSession.get(sessionId) as SessionRow | undefined;
  },
};
