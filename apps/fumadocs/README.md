# cyop Docs

`apps/fumadocs` 是 `cyop` 的项目文档站，基于 **Next.js 16 + Fumadocs** 构建。

## 作用

这个应用主要负责：

- 展示项目介绍与产品能力
- 提供开发接入、环境配置、架构说明
- 维护 API / 数据模型 / 工作流文档
- 作为团队内部的统一知识入口

文档内容目录：

```txt
content/docs/
```

核心实现文件：

| 路径 | 说明 |
| --- | --- |
| `src/lib/source.ts` | Fumadocs 内容源配置 |
| `src/lib/layout.shared.tsx` | 文档站全局布局配置 |
| `src/app/docs/layout.tsx` | `/docs` 文档布局 |
| `src/app/(home)` | 首页与 Landing 页面 |
| `content/docs/*.mdx` | 文档正文 |
| `source.config.ts` | MDX / frontmatter 配置 |

---

## 本地开发

```bash
bun --cwd apps/fumadocs run dev
```

默认端口：

- Home: http://localhost:4000
- Docs: http://localhost:4000/docs

---

## 构建

```bash
bun --cwd apps/fumadocs run build
```

生产启动：

```bash
bun --cwd apps/fumadocs run start
```

---

## 编写文档

新增一篇文档时，直接在 `content/docs` 下创建 `.mdx` 文件即可，例如：

```txt
content/docs/getting-started.mdx
```

建议 frontmatter 至少包含：

```mdx
---
title: Getting Started
description: 如何在本地运行项目
---
```

---

## 推荐维护方式

- 产品变化时，同步更新 `README.md` 与 `content/docs`
- 新增模块时，同时补一页对应文档
- 修改环境变量时，优先更新：
  - `apps/server/.env.example`
  - `apps/web/.env.example`
  - `README.md`
  - `content/docs/getting-started.mdx`

---

## 相关链接

- 仓库根 README：`../../README.md`
- Fumadocs 文档：https://fumadocs.dev
- Next.js 文档：https://nextjs.org/docs
