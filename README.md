# cyop

cyop 是一个面向 AI 素材生产与运营流程的内部平台原型，当前仓库已经不只是 Better-T-Stack 的初始化模板了。

现在这套东西主要在做几件事：

- 用 **Requirements / Datasets / Tasks** 管理素材生产流程
- 用 **Caption Jobs / Captions / Prompt Templates** 支撑 AI 打标与批处理
- 提供一个 **React + TanStack Router** 的 Web 控制台
- 提供一个 **Hono + tRPC + Better Auth** 的后端服务
- 用 **Drizzle + PostgreSQL(Neon)** 管数据
- 支持 **S3 兼容对象存储** 和自动化回调的扩展能力

## Tech Stack

- Bun + TypeScript
- Turborepo monorepo
- React 19 + Vite + TanStack Router + React Query
- Hono + tRPC
- Better Auth
- Drizzle ORM + PostgreSQL
- Tailwind CSS + 自定义 UI package
- Biome + Husky

## Workspace Layout

```text
cyop/
├── apps/
│   ├── web/         # 前端控制台（Vite + React + TanStack Router）
│   ├── server/      # API / Auth 服务（Hono + tRPC）
│   └── fumadocs/    # 文档站点（存在但不是当前主线）
├── packages/
│   ├── api/         # tRPC router / context / 业务服务
│   ├── auth/        # Better Auth 配置
│   ├── db/          # Drizzle schema / migration / DB 入口
│   ├── ui/          # 共享 UI 组件
│   └── config/      # 共享配置包
└── .github/workflows/release.yml
```

## Current Product Surface

当前 Web 端已经有这些主要页面：

- `/`：落地页
- `/login`：登录 / 注册
- `/dashboard`：需求、数据集、任务总览与录入（需登录）
- `/media`：素材库视图（需登录）
- `/todos`：AI 模型、Caption 批处理、任务操作台（需登录）
- `/editor`：编辑器页面（需登录）

其中 `/dashboard`、`/media`、`/todos`、`/editor` 当前都在路由层通过 `requireSession()` 做鉴权，未登录会直接跳到 `/login`。

最近还做了路由 lazy load 和 devtools 拆分，说明前端已经开始进入“能持续迭代”的阶段，不再只是 demo 壳子。

## Quick Start

### 1) Install dependencies

```bash
bun install
```

### 2) Configure env files

#### `apps/server/.env`

最少需要这些：

```env
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
```

如果你要跑素材 / 自动化 / AI caption 相关能力，再补这些：

```env
AUTOMATION_WEBHOOK_URL=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_REGION=
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
ASSET_PUBLIC_URL=
AI_CAPTION_MODEL=
AI_CAPTION_API_KEY=
AI_CAPTION_BASE_URL=
AI_CAPTION_PROMPT=
```

#### `apps/web/.env.example`

```env
VITE_SERVER_URL=http://localhost:3000
```

实际使用时建议在 `apps/web/.env` 里配置：

```env
VITE_SERVER_URL=http://localhost:3000
```

#### `apps/fumadocs/.env.example`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_DOCS_SITE_URL=https://docs.cyop.design
```

- `NEXT_PUBLIC_APP_URL`：文档站首页“返回控制塔”按钮跳转地址
- `NEXT_PUBLIC_DOCS_SITE_URL`：文档站公开访问域名，用于 Next.js `metadataBase` 与 OG 图片链接生成

### 3) Push database schema

```bash
bun run db:push
```

### 4) Start development

```bash
bun run dev
```

默认端口：

- Web: <http://localhost:3001>
- API: <http://localhost:3000>

## Useful Commands

### Development

```bash
bun run dev
bun run dev:web
bun run dev:server
```

### Build

```bash
bun run build
cd apps/web && bun run build
cd apps/server && bun run build
```

### Type Check / Formatting

```bash
bun run check-types
bun run check
```

注意：根目录的 `bun run check` 当前执行的是 `biome check --write .`，也就是**会直接改写文件**，它更接近“格式化 + 自动修复”，不是只读校验。

如果你只是想在提交前确认仓库能不能过 CI，优先跑：

```bash
bun run check-types
bun run build
```

### Database

```bash
bun run db:push
bun run db:generate
bun run db:migrate
bun run db:studio
```

## Notes for Contributors

### Auth / cookies

`packages/auth` 里默认把 cookie 设成了：

- `sameSite: "none"`
- `secure: true`
- `httpOnly: true`

所以如果你在本地调试登录流程，记得一起检查：

- 前后端 origin 是否匹配
- 是否走 HTTPS / 代理
- `BETTER_AUTH_URL` / `CORS_ORIGIN` / `VITE_SERVER_URL` 是否一致

### Environment propagation

根目录 `turbo.json` 已经把这些环境变量列进了 `globalEnv`，改部署或接入新服务时优先同步这里：

- 数据库
- Auth
- S3 / 资源地址
- 自动化 webhook
- AI caption 配置
- `VITE_SERVER_URL`
- `NEXT_PUBLIC_APP_URL`（文档站首页里“返回控制塔”的跳转地址）
- `NEXT_PUBLIC_DOCS_SITE_URL`（文档站的公开基地址，用于 metadata / OG 图片）

### Object storage support

服务端当前走的是 **S3-compatible** 配置，不绑死某一家云厂商；`S3_FORCE_PATH_STYLE` 也已经留了开关，兼容 MinIO / R2 / 各类兼容存储会更方便。

## Release

仓库里目前有一个 tag release workflow：推送 `v*` tag 时会触发 `.github/workflows/release.yml`，通过 `changelogithub` 生成 release。

## CI status

仓库已经有 `.github/workflows/ci.yml`，当前会在 `push main` 和 `pull_request` 时执行：

- `bun install --frozen-lockfile`
- `bun run check-types`
- `bun run build`

也就是说，想提前本地对齐 CI，直接跑下面这组就行：

```bash
bun run check-types
bun run build
```

## What still needs love

这个仓库接下来比较值得继续补的方向：

- 补一份真正可执行的部署文档（尤其是 Web 静态部署 + Server 独立部署）
- 给 caption / dataset / requirement 核心流程补最小测试
- 把 `.env.example` 再细化成“必填 / 选填 / 仅生产环境”
- 视情况把只读 lint / format 校验拆出来，和当前会改文件的 `bun run check` 分开

如果你刚接手这个仓库，先看这里，再去看 `packages/db/src/schema` 和 `packages/api/src/routers`，会比直接从模板结构猜快很多。