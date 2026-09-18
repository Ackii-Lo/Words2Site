import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema：物理列名与既有数据库逐列一致（snake_case 键 = 列名），
 * 保证存量库在 push 自动同步时零变更。改表 = 改这里，启动时自动同步。
 * 注意：不声明 partial unique index（旧库的 idx_tasks_domain）——drizzle-kit
 * 对 partial index 的 diff 无法收敛（连自身生成的文本都判差异，每轮 DROP+CREATE），
 * 首次同步会把它 DROP 掉；域名占用唯一性由应用层 domainTaken 查询保证
 * （且语义更准：失败任务不占坑是查询条件，索引表达不了）。
 */
export const tasksTable = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").unique(),
    prompt: text("prompt").notNull(),
    transcript: text("transcript"),
    /** queued/generating/validating/done/published/failed */
    status: text("status").notNull(),
    /** 人类可读的当前阶段说明 */
    stage: text("stage"),
    codex_session_id: text("codex_session_id"),
    workdir: text("workdir"),
    error: text("error"),
    attempts: integer("attempts").default(0),
    refinements: integer("refinements").default(0),
    ip: text("ip"),
    device_id: text("device_id"),
    html_size: integer("html_size"),
    publish_url: text("publish_url"),
    email: text("email"),
    domain: text("domain"),
    is_public: integer("is_public").default(1),
    removed_at: integer("removed_at"),
    /** 0 无 1 有（data/tasks/<id>/shot.png） */
    screenshot: integer("screenshot").default(0),
    created_at: integer("created_at"),
    finished_at: integer("finished_at"),
  },
  (t) => [
    index("idx_tasks_status").on(t.status),
    index("idx_tasks_ip").on(t.ip),
  ],
);

export const sessionsTable = sqliteTable("codex_sessions", {
  // notNull 显式声明：drizzle-kit 生成 PK 必带 NOT NULL，schema 不标会陷入
  //「每轮重建却不收敛」的自相矛盾（生成补 NOT NULL，快照对比又判有差）
  session_id: text("session_id").primaryKey().notNull(),
  task_id: text("task_id"),
  pid: integer("pid"),
  /** spawning/generating/done/killed/failed */
  state: text("state").notNull(),
  workdir: text("workdir"),
  started_at: integer("started_at"),
  ended_at: integer("ended_at"),
});
