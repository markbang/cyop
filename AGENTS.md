# Repository Guidelines

## Project Structure & Module Organization
Turborepo + Bun split code into `apps` and `packages`. `apps/web` (React + TanStack Router, Vite 3001) serves the client, `apps/server` (Bun/Hono, 3000) exposes the API, and `apps/fumadocs` stores documentation content. Shared logic sits in `packages`: `api` for tRPC routers, `auth` for Better-Auth wiring, `db` for Drizzle schema/migrations, and `config` for tsconfig/biome presets. Keep page code under `apps/web/src/routes/<segment>/` and import shared utilities via `@cyop/*` aliases.

## Build, Test, and Development Commands
- `bun install` – install workspace deps.
- `bun run dev[:web|:server]` – Turbo dev servers (web 3001, API 3000) with optional focus.
- `bun run build` – monorepo production build; run before packaging `apps/web/dist` for hosting.
- `bun run check-types` – run all TypeScript project references.
- `bun run check` – Biome format + lint, also enforced by Husky/lint-staged.
- `bun run db:push` / `bun run db:studio` – apply or inspect Drizzle migrations using `apps/server/.env`.

## Coding Style & Naming Conventions
Biome (see `biome.json`) is authoritative: tab indentation, double quotes, and class sorting for `clsx`/`cva`/`cn`. Run `bun run check` locally; Husky enforces it on commit. Use PascalCase for React components, camelCase for hooks/utilities, SCREAMING_SNAKE_CASE for env vars, and singular table names in Drizzle. Colocate modules, expose them through short `index.ts` barrels, and import via `@cyop/*` aliases.

## Testing Guidelines
Automated suites are still forming, so each PR must explain how the change was validated. When you add tests, use Bun’s built-in runner for Hono/tRPC modules (co-located specs) and Vitest + React Testing Library for UI logic under `apps/web/src/__tests__/`. Cover new routes, forms, and migrations, and do not merge without at least a smoke test or a reproducible manual script.

## Commit & Pull Request Guidelines
History currently has only the initial commit, so prefer Conventional Commit subjects (e.g., `feat(web): add onboarding layout`). Before pushing, run `bun run check`, `bun run check-types`, and the relevant `bun run dev:*`. Each PR needs a summary, linked issue, UI screenshots when applicable, and database notes (command + rollback plan). Highlight new env vars or deployment settings so reviewers can sync quickly.

## Security & Configuration Tips
Keep secrets in untracked `.env` files (e.g., `apps/server/.env` for PostgreSQL and Better-Auth keys) or your hosting provider’s secret manager. Run `bun run db:push` against a disposable database when changing `packages/db`, and document destructive steps. Never leak secrets into the client bundle—proxy them through `packages/api` or Hono handlers instead.
