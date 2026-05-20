# Backup and Restore Strategy

## Overview

cyop stores all state in PostgreSQL. The critical data includes:

| Table | Importance | Recovery priority |
|-------|-----------|-------------------|
| `requirements` | Critical — product scope | 1 |
| `datasets` | Critical — links requirements to media | 1 |
| `captions` / `caption_jobs` | Critical — generated captions | 1 |
| `media_assets` | Important — reconstructable from S3 | 2 |
| `ai_models`, `prompt_templates` | Important — configuration | 2 |
| `automation_tasks` | Low — operational ephemera | 3 |
| Auth tables (`user`, `session`, `account`, `verification`) | Critical — user accounts | 1 |

---

## Neon Serverless Backup (Recommended)

If using Neon (the default), database branching provides point-in-time recovery:

```bash
# Create a backup branch from current state
npx neon branches create --name backup-$(date +%Y%m%d)

# Restore: create a new branch from the backup point
npx neon branches create --name recovery --parent backup-20260101
```

Neon's built-in Point-in-Time Recovery (PITR) allows restoring to any point within the retention window (7 days on free tier, up to 30 days on paid plans).

---

## pg_dump Backup (Self-managed PostgreSQL)

### Automated backup script

```bash
#!/bin/bash
# backup.sh — run daily via cron
set -euo pipefail

BACKUP_DIR="/var/backups/cyop"
DATABASE_URL="${DATABASE_URL:?must be set}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Full dump
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="$BACKUP_DIR/cyop-$TIMESTAMP.dump"

# Schema-only dump (for quick inspection)
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --file="$BACKUP_DIR/cyop-schema-$TIMESTAMP.sql"

# Cleanup old backups
find "$BACKUP_DIR" -name "cyop-*.dump" -mtime +$RETENTION_DAYS -delete
```

### Cron schedule

```
0 3 * * * /opt/cyop/scripts/backup.sh >> /var/log/cyop-backup.log 2>&1
```

### Restore

```bash
# Full restore from dump
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname="$DATABASE_URL" \
  /var/backups/cyop/cyop-20260101-030000.dump
```

---

## Pre-migration Backup

Before running `db:migrate` in production:

```bash
# 1. Create a manual backup
pg_dump "$DATABASE_URL" --format=custom --file=pre-migration-$(date +%Y%m%d-%H%M).dump

# 2. Apply migration
bun run db:migrate

# 3. Verify critical queries work
# Check row counts, key relationships, etc.

# 4. If something went wrong, restore
pg_restore --clean --if-exists --dbname="$DATABASE_URL" pre-migration-*.dump
```

---

## S3 Media Backup

Media files are stored in S3-compatible storage. Recovery strategy depends on your provider:

- **Cloudflare R2 / AWS S3**: Enable bucket versioning and cross-region replication
- **MinIO (self-hosted)**: Use `mc mirror` to sync to a backup location

```bash
# Mirror S3 bucket to backup location
mc mirror mybucket/backup-bucket/ --watch
```
