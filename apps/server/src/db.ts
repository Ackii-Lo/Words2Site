import Database from "better-sqlite3";
import path from "node:path";
import { and, desc, eq, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { config } from "./config.js";
import { sessionsTable, tasksTable } from "./schema.js";

export const db = drizzle(
  new Database(path.join(config.dataDir, "words2site.db")),
  { schema: { tasksTable, sessionsTable } },
);
db.$client.pragma("journal_mode = WAL");

// 自动同步模式：schema 定义即真相，启动时 push 到库（等价 drizzle-kit push）。
// 存量库与定义一致时零语句；改表只需改 schema.ts，下次启动自动生效。
// 注意：不走 result.apply()——drizzle-kit 内部用 all() 执行 DDL，
// better-sqlite3 驱动对无返回语句会抛错，改用底层 exec 逐条执行。
{
  const result = await pushSQLiteSchema(
    { tasksTable, sessionsTable },
    db as never,
  );
  if (result.statementsToExecute.length) {
    console.log(
      `[db] schema 自动同步 ${result.statementsToExecute.length} 条语句`,
    );
    if (result.hasDataLoss) {
      console.warn("[db] 警告：本次同步包含数据丢失语句", result.warnings);
    }
    // 变更前备份（SQLite backup API，WAL 安全；固定名，保留最近一次）
    await db.$client.backup(path.join(config.dataDir, "words2site.db.bak"));
    for (const stmt of result.statementsToExecute) {
      try {
        db.$client.exec(stmt);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // 重建序列的幂等边界：目标对象已存在，跳过即可
        if (/already exists/i.test(msg)) {
          console.warn(`[db] 跳过(已存在): ${stmt.slice(0, 60)}…`);
          continue;
        }
        throw e;
      }
    }
    // 同步一次到位：跳过语句可能让库仍与定义有差，递归再推一轮直至零语句
    const again = await pushSQLiteSchema(
      { tasksTable, sessionsTable },
      db as never,
    );
    if (again.statementsToExecute.length) {
      console.warn(
        `[db] 同步后仍余 ${again.statementsToExecute.length} 条未收敛，下次启动继续`,
      );
    }
  }
}

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
  style_hint: string | null;
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
    styleHint: string | null;
  }) {
    db.insert(tasksTable)
      .values({
        id: p.id,
        prompt: p.prompt,
        transcript: p.transcript,
        status: "queued",
        ip: p.ip,
        device_id: p.deviceId,
        email: p.email,
        domain: p.domain,
        is_public: p.isPublic ? 1 : 0,
        style_hint: p.styleHint,
        created_at: Date.now(),
      })
      .run();
  },
  domainTaken(domain: string): boolean {
    return (
      db
        .select({ n: sql<number>`count(*)` })
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.domain, domain),
            isNull(tasksTable.removed_at),
            ne(tasksTable.status, "failed"),
          ),
        )
        .get()!.n > 0
    );
  },
  domainTakenByOther(domain: string, id: string): boolean {
    return (
      db
        .select({ n: sql<number>`count(*)` })
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.domain, domain),
            isNull(tasksTable.removed_at),
            ne(tasksTable.status, "failed"),
            ne(tasksTable.id, id),
          ),
        )
        .get()!.n > 0
    );
  },
  listScreen(): Array<{
    id: string;
    code: string | null;
    domain: string | null;
    publish_url: string | null;
    prompt: string;
    screenshot: number;
    created_at: number;
    style_hint: string | null;
  }> {
    return db
      .select({
        id: tasksTable.id,
        code: tasksTable.code,
        domain: tasksTable.domain,
        publish_url: tasksTable.publish_url,
        prompt: tasksTable.prompt,
        screenshot: tasksTable.screenshot,
        created_at: tasksTable.created_at,
        style_hint: tasksTable.style_hint,
      })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.status, "published"),
          eq(tasksTable.is_public, 1),
          isNull(tasksTable.removed_at),
          isNotNull(tasksTable.publish_url),
        ),
      )
      .orderBy(desc(tasksTable.created_at))
      .limit(50)
      .all() as never;
  },
  get(id: string): TaskRow | undefined {
    return db.select().from(tasksTable).where(eq(tasksTable.id, id)).get() as
      TaskRow | undefined;
  },
  getByCode(code: string): TaskRow | undefined {
    return db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.code, code))
      .get() as TaskRow | undefined;
  },
  /** 局部更新：只写传入字段（error 传 null 显式清空，不传则保留） */
  update(p: Partial<TaskRow> & { id: string }) {
    const { id, ...rest } = p;
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) set[k] = v;
    if (Object.keys(set).length === 0) return;
    db.update(tasksTable).set(set).where(eq(tasksTable.id, id)).run();
  },
  queuePosition(createdAt: number): number {
    return db
      .select({ n: sql<number>`count(*)` })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.status, "queued"),
          lt(tasksTable.created_at, createdAt),
        ),
      )
      .get()!.n;
  },
  page(pageNo: number, pageSize = 50): TaskRow[] {
    return db
      .select()
      .from(tasksTable)
      .orderBy(desc(tasksTable.created_at))
      .limit(pageSize)
      .offset((pageNo - 1) * pageSize)
      .all() as unknown as TaskRow[];
  },
  stats() {
    return db
      .select({
        active: sql<number>`count(*) filter (where ${tasksTable.status} in ('queued','generating','validating'))`,
        done: sql<number>`count(*) filter (where ${tasksTable.status} = 'done')`,
        published: sql<number>`count(*) filter (where ${tasksTable.status} = 'published')`,
        failed: sql<number>`count(*) filter (where ${tasksTable.status} = 'failed')`,
        avg_ms: sql<
          number | null
        >`avg(${tasksTable.finished_at} - ${tasksTable.created_at}) filter (where ${tasksTable.finished_at} is not null)`,
      })
      .from(tasksTable)
      .get()!;
  },
};

export const sessions = {
  upsert(p: {
    sessionId: string;
    taskId: string | null;
    pid: number | null;
    state: string;
    workdir: string | null;
  }) {
    db.insert(sessionsTable)
      .values({
        session_id: p.sessionId,
        task_id: p.taskId,
        pid: p.pid,
        state: p.state,
        workdir: p.workdir,
        started_at: Date.now(),
      })
      // 旧语义：state 总是覆盖；task_id/pid/workdir 空则保留原值
      .onConflictDoUpdate({
        target: sessionsTable.session_id,
        set: {
          state: p.state,
          task_id: sql`coalesce(excluded.task_id, codex_sessions.task_id)`,
          pid: sql`coalesce(excluded.pid, codex_sessions.pid)`,
          workdir: sql`coalesce(excluded.workdir, codex_sessions.workdir)`,
        },
      })
      .run();
  },
  setState(sessionId: string, state: string, ended = false) {
    const set: Record<string, unknown> = { state };
    if (ended) set.ended_at = Date.now();
    db.update(sessionsTable)
      .set(set)
      .where(eq(sessionsTable.session_id, sessionId))
      .run();
  },
  list(): SessionRow[] {
    return db
      .select()
      .from(sessionsTable)
      .orderBy(desc(sessionsTable.started_at))
      .limit(100)
      .all() as unknown as SessionRow[];
  },
  get(sessionId: string): SessionRow | undefined {
    return db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.session_id, sessionId))
      .get() as SessionRow | undefined;
  },
};
