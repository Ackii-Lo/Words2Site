import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema：物理列名与既有数据库逐列一致（snake_case 键 = 列名），
 * 保证存量库在 push 自动同步时零变更。改表 = 改这里，启动时自动同步。
 * 注意：不声明 partial unique index（旧库的 idx_tasks_domain）——drizzle-kit
 * 对 partial index 的 diff 无法收敛（连自身生成的文本都判差异，每轮 DROP+CREATE），
 * 首次同步会把它 DROP 掉；域名占用唯一性由 domain_reservations 表保证
 * （原子预约 + 失败释放，见 db.ts reservations 仓库）。
 */
export const tasksTable = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").unique(),
    prompt: text("prompt").notNull(),
    transcript: text("transcript"),
    /** queued/generating/validating/publishing/published/failed（done 仅存量兼容） */
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
    /**
     * 大屏卡片外壳（七式之一：archive/fullscreen/spine/bigno/collage/bubble/classic）。
     * 创建任务时由主题关键词分类器一次性算出并写入；前台只读不判。
     *
     * 注意：这里**不要**加 .default()。drizzle-kit 对 SQLite 只在「新增可空无默认列」
     * 时才生成 ALTER TABLE ADD COLUMN；一旦带 DEFAULT 就退化为整表重建，
     * 而重建序列里的 `INSERT ... SELECT "style_hint" FROM tasks` 会引用尚不存在的新列
     * 直接报错（旧库上服务起不来）。历史行的 NULL 由前端兜底成默认外壳。
     */
    style_hint: text("style_hint"),
  },
  (t) => [
    index("idx_tasks_status").on(t.status),
    index("idx_tasks_ip").on(t.ip),
  ],
);

/**
 * 域名预约表：domain 全局唯一的唯一真相源。
 * 旧方案是 tasks 表上的 check-then-insert（domainTaken → create），并发下有竞态；
 * 现改为 insert ... onConflictDoNothing 原子预约（PK 冲突即占用），失败任务释放后可再约。
 */
export const domainReservationsTable = sqliteTable("domain_reservations", {
  domain: text("domain").primaryKey().notNull(),
  task_id: text("task_id").notNull(),
  created_at: integer("created_at"),
});

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
  /** 累计 token 消耗（codex 结束行解析）；可空无 default → 简单 ADD COLUMN */
  tokens_used: integer("tokens_used"),
  /** 最近一次 stdout 输出时间（卡点观测） */
  last_output_at: integer("last_output_at"),
});
