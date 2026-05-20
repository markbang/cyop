# Deployment Guide

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web (SPA)   │────▶│  Server API  │────▶│  PostgreSQL  │
│  static CDN  │     │  Bun/Hono    │     │  (Neon)      │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ├──▶ S3-compatible storage
                            └──▶ AI API (OpenAI-compatible)
```

Two deployable units:
- **Web**: static SPA, deploy to any CDN or static host
- **Server**: Bun runtime, deploy as systemd service or Docker container

---

## Prerequisites

- Bun >= 1.2
- PostgreSQL (Neon serverless recommended)
- S3-compatible object storage (optional, for media upload)
- OpenAI-compatible API key (optional, for AI caption generation)

---

## 1. Environment Variables

### Server (`apps/server/.env`)

**Required:**

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<random-64-char-string>
BETTER_AUTH_URL=https://api.yourdomain.com
CORS_ORIGIN=https://yourdomain.com
NODE_ENV=production
```

**Optional (S3 media upload):**

```env
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_REGION=
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
ASSET_PUBLIC_URL=
```

**Optional (AI caption):**

```env
AI_CAPTION_MODEL=
AI_CAPTION_API_KEY=
AI_CAPTION_BASE_URL=
AI_CAPTION_PROMPT=
```

**Optional (automation):**

```env
AUTOMATION_WEBHOOK_URL=
```

### Web (`apps/web/.env`)

```env
VITE_SERVER_URL=https://api.yourdomain.com
```

---

## 2. Database Migration

### First deploy

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations to database
bun run db:migrate
```

### Schema changes (subsequent deploys)

```bash
# 1. Edit schema files in packages/db/src/schema/
# 2. Generate new migration
bun run db:generate
# 3. Review the generated SQL in packages/db/src/migrations/
# 4. Commit the migration files
# 5. Apply in production
bun run db:migrate
```

Migration files live in `packages/db/src/migrations/` and must be committed to git. Never use `db:push` in production.

---

## 3. Build

```bash
# Install dependencies
bun install

# Build all packages
bun run build
```

Artifacts:
- Server: `apps/server/dist/index.js`
- Web: `apps/web/dist/` (static files)

---

## 4. Server Deployment

### Option A: systemd (recommended for single server)

```ini
# /etc/systemd/system/cyop-server.service
[Unit]
Description=cyop API Server
After=network.target

[Service]
Type=simple
User=cyop
WorkingDirectory=/opt/cyop
EnvironmentFile=/opt/cyop/apps/server/.env
ExecStart=/usr/bin/bun run apps/server/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now cyop-server
```

### Option B: Docker

```dockerfile
FROM oven/bun:1.2-alpine
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build
WORKDIR /app/apps/server
CMD ["bun", "run", "dist/index.js"]
```

### Option C: Standalone binary

```bash
cd apps/server && bun run compile
# Produces a self-contained ./server binary
```

### Health check

```bash
curl https://api.yourdomain.com/
# Returns "OK"
```

---

## 5. Web (Frontend) Deployment

The web build produces static files in `apps/web/dist/`. Deploy to any static host.

### Option A: Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/cyop;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Option B: Cloudflare Pages / Vercel / Netlify

- Build command: `bun run build`
- Output directory: `apps/web/dist`
- Set `VITE_SERVER_URL` environment variable pointing to your API server

---

## 6. Reverse Proxy (recommended)

Use Nginx or Caddy in front of the server:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.pem;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

HTTPS is required in production for auth cookies (`secure: true`).

---

## 7. Verification

After deployment:

```bash
# API health
curl https://api.yourdomain.com/

# Auth
curl https://api.yourdomain.com/api/auth/sign-in/email -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"..."}'

# Frontend
open https://yourdomain.com
```

---

## 8. Rollback

```bash
# Database rollback (if needed)
git checkout <previous-commit> -- packages/db/src/migrations/
bun run db:migrate  # drizzle-kit will detect and revert

# Application rollback
git checkout <previous-tag>
bun install --frozen-lockfile
bun run build
sudo systemctl restart cyop-server
```
