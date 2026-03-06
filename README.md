# cyop

> 面向创意生产团队的图像资产管理与 AI 自动化协作平台。

`cyop`（creative ops）是一个基于 **Bun + Turborepo** 的全栈 TypeScript Monorepo，聚焦于图片生产链路中的几个核心问题：

- 需求如何结构化沉淀
- 数据集如何持续累积和追踪健康度
- 素材如何上传、归档、预览与分发
- AI Caption / Tagging 如何批量执行与复核
- 模型、Prompt、任务调度如何统一管理

当前仓库已经包含可运行的 Web 控制台、API 服务、共享 UI 包、数据库 schema，以及 Fumadocs 文档站。

---

## 功能概览

### 产品模块

- **首页 / 概览**：展示 API 健康状态、覆盖率与基础运营指标
- **控制塔 `/dashboard`**：需求、数据集、任务、标签洞察统一看板
- **素材库 `/media`**：S3 直传、素材预览、删除、链接复制
- **Caption 审核台 `/editor`**：AI 生成描述的筛选、编辑、通过、驳回、导出
- **AI 模型与批处理 `/todos`**：模型注册、单图测试、批处理创建与队列执行
- **文档站 `/docs`**：项目说明、架构、工作流与部署文档

### 技术特性

- **React 19** + **TanStack Router**（Web）
- **Hono** + **tRPC**（Server）
- **Drizzle ORM** + **PostgreSQL / Neon**（DB）
- **Better Auth**（认证）
- **Tailwind CSS v4** + 自建 `@cyop/ui` 组件库
- **Fumadocs**（文档站）
- **Biome**（格式化 / Lint）
- **Turbo**（Monorepo 任务编排）
- **Bun**（Runtime / Package Manager）

---

## 仓库结构

```txt
cyop/
├─ apps/
│  ├─ web/          # React + TanStack Router 控制台（3001）
│  ├─ server/       # Bun + Hono + tRPC API（3000）
│  └─ fumadocs/     # Next.js + Fumadocs 文档站（4000）
├─ packages/
│  ├─ api/          # tRPC routers、服务编排、业务逻辑
│  ├─ auth/         # Better Auth 配置
│  ├─ db/           # Drizzle schema、迁移与数据库连接
│  ├─ ui/           # 共享 UI 组件
│  └─ config/       # TS / Biome 配置
└─ AGENTS.md        # 仓库协作约定
```

### 关键目录说明

| 路径 | 说明 |
| --- | --- |
| `apps/web/src/routes` | 前端页面与路由入口 |
| `apps/web/src/components` | 业务组件与布局组件 |
| `packages/api/src/routers` | tRPC 路由模块 |
| `packages/api/src/services` | Caption、Storage、Automation 等服务层 |
| `packages/db/src/schema` | Drizzle schema，平台数据模型与 auth 表 |
| `apps/fumadocs/content/docs` | 项目文档内容 |

---

## 快速开始

## 1. 安装依赖

```bash
bun install
```

## 2. 配置环境变量

复制示例文件：

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

### `apps/server/.env`

最少需要配置：

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
```

如果你要启用素材上传与公开访问，还需要：

```bash
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_REGION=
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
ASSET_PUBLIC_URL=
```

如果你要启用 AI Caption：

```bash
AI_CAPTION_MODEL=
AI_CAPTION_API_KEY=
AI_CAPTION_BASE_URL=
AI_CAPTION_PROMPT=
```

如果你需要把事件推送到自动化系统：

```bash
AUTOMATION_WEBHOOK_URL=
```

### `apps/web/.env`

```bash
VITE_SERVER_URL=http://localhost:3000
```

---

## 3. 初始化数据库

```bash
bun run db:push
```

如果你想查看数据：

```bash
bun run db:studio
```

---

## 4. 启动开发环境

```bash
bun run dev
```

默认端口：

- Web: http://localhost:3001
- API: http://localhost:3000
- Docs: http://localhost:4000

也可以单独启动：

```bash
bun run dev:web
bun run dev:server
bun --cwd apps/fumadocs run dev
```

---

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev` | 启动全部开发服务 |
| `bun run dev:web` | 仅启动 Web |
| `bun run dev:server` | 仅启动 Server |
| `bun run build` | 构建整个 Monorepo |
| `bun run check-types` | 运行全仓 TypeScript 检查 |
| `bun run check` | 运行 Biome 格式化与 Lint |
| `bun run db:push` | 推送 schema 到数据库 |
| `bun run db:generate` | 生成 Drizzle migration |
| `bun run db:migrate` | 执行 Drizzle migration |
| `bun run db:studio` | 打开 Drizzle Studio |

---

## 数据模型与业务主线

平台核心链路：

1. **Requirement**：记录业务需求、负责人、优先级、目标覆盖率
2. **Dataset**：按需求沉淀数据集，统计图片量与 AI 覆盖情况
3. **Media Asset**：素材上传到对象存储，并记录尺寸、URL、状态
4. **Caption / Caption Job**：通过模型与 Prompt 生成描述并进入审核流
5. **Automation Task**：调度批量任务，追踪队列、进度、失败原因
6. **Tag / Analytics**：记录标签覆盖率与使用情况

主要表定义位于：

- `packages/db/src/schema/platform.ts`
- `packages/db/src/schema/auth.ts`

---

## API 模块

`tRPC` 根路由位于 `packages/api/src/routers/index.ts`。

| Router | 说明 |
| --- | --- |
| `requirement` | 需求列表、状态更新、统计 |
| `dataset` | 数据集创建、指标更新 |
| `task` | 自动化任务创建与状态更新 |
| `tag` | 标签洞察 |
| `media` | 上传签名、素材列表、删除 |
| `caption` | 审核流、导出、批量通过 / 驳回 |
| `captionOps` | 单次生成、批量入队、批量执行 |
| `prompt` | Prompt 模板管理 |
| `model` | AI 模型管理 |
| `todo` | 示例 / 演示数据接口 |
| `healthCheck` | 健康检查 |

---

## 前端页面地图

| 路由 | 说明 |
| --- | --- |
| `/` | 落地页与运行指标 |
| `/login` | 登录 / 注册 |
| `/dashboard` | 控制塔 |
| `/media` | 素材上传与素材库 |
| `/editor` | Caption 审核台 |
| `/todos` | AI 模型与批处理 |

---

## 文档站

项目文档位于 `apps/fumadocs`，内容在：

```txt
apps/fumadocs/content/docs
```

启动文档站：

```bash
bun --cwd apps/fumadocs run dev
```

默认地址：

- Home: http://localhost:4000
- Docs: http://localhost:4000/docs

---

## 部署建议

### Web

```bash
bun run build
```

静态资源输出在：

```txt
apps/web/dist
```

适合部署到静态托管/CDN。

### Server

```bash
cd apps/server && bun run build
```

或者生成单文件可执行：

```bash
cd apps/server && bun run compile
```

### Docs

```bash
cd apps/fumadocs && bun run build
```

---

## 开发约定

提交前建议至少运行：

```bash
bun run check
bun run check-types
```

仓库风格约定见：

- `AGENTS.md`

核心要求包括：

- 使用 `@cyop/*` workspace alias
- 遵循 Biome 格式化结果
- React 组件使用 PascalCase
- 路由代码放在 `apps/web/src/routes/<segment>/`
- 共享逻辑优先抽到 `packages/*`

---

## 下一步建议

如果你刚接手这个仓库，推荐按这个顺序阅读：

1. `apps/fumadocs/content/docs/index.mdx`
2. `apps/fumadocs/content/docs/getting-started.mdx`
3. `apps/fumadocs/content/docs/architecture.mdx`
4. `packages/api/src/routers/index.ts`
5. `packages/db/src/schema/platform.ts`

如果你想继续完善项目，可以优先从这几类工作入手：

- 增加真实业务表与迁移策略
- 为 Web 页面补测试
- 为批处理/队列补后台 worker 与监控
- 补齐部署模板与 `.env` 说明

---

## License

当前仓库未单独声明 License；如需开源，请补充 `LICENSE` 文件与发布说明。
