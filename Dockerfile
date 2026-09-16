# syntax=docker/dockerfile:1
# 纯后端镜像（不含 apps/web/dist；前端走 EdgeOne Pages 等异地部署，
# Express 检测不到 ../../web/dist 时自动跳过 SPA 托管）。
# 多阶段 pnpm 镜像，层按变更频率排序：manifests → 依赖安装 → 构建 → 运行时，
# 源码小改只重建 build stage 与最终 COPY 层。

# ---- Stage 1: deps（仅 manifests，源码改动不失效） ----
FROM node:22-slim AS deps
RUN corepack enable
WORKDIR /app
# pnpm workspace：--frozen-lockfile 要求所有 workspace 的 package.json 就位
# .npmrc 把 @buf scope 指向 BSR registry（BSR 生成的 SDK 不在 npmjs 上）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @words2site/server...

# ---- Stage 2: build ----
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app ./
COPY apps/server apps/server
RUN pnpm --filter @words2site/server build

# ---- Stage 3: runtime（生产依赖 + 构建产物 + codex CLI） ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production DATA_DIR=/data
# codex CLI（npm 包自带平台二进制；认证走 CODEX_BASE_URL/CODEX_API_KEY 环境变量）
RUN corepack enable \
    && npm install -g @openai/codex \
    && mkdir -p /data && chown node:node /data
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter @words2site/server...
COPY --from=build /app/apps/server/dist apps/server/dist
USER node
WORKDIR /app/apps/server
EXPOSE 3000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["node", "dist/index.js"]
