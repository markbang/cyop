# ADR-0001: QStash-based async caption queue

**Status:** Accepted
**Date:** 2026-05-20

## Context

Cyop processes AI image captions at scale — up to millions of images per dataset. Each caption requires a vision API call (2-5s). The existing architecture runs captioning synchronously inside a tRPC mutation on Vercel Free tier (10s timeout), making batch processing infeasible without manual chunking.

## Decision

Use [QStash](https://upstash.com/qstash) (Upstash) as the message queue, with Vercel Cron as the scheduler and Vercel functions as workers:

```
Vercel Cron (1/min) → dispatch function → QStash → worker function (1 msg/call)
```

Key design points:

1. **QStash per-message delivery** — one caption job per QStash message, each triggers a single Vercel function call. This fits Vercel Free's 10s timeout (one image = 2-5s + retry headroom).
2. **DB as ground truth** — the `captions` table is the source of record. QStash is a transport, not state storage. Status field tracks: `pending → queued → processing → completed/rejected`.
3. **In-function retry first, QStash retry second** — the worker keeps the existing `callCaptionApi` retry logic (4 attempts, exponential backoff on 429/5xx). Only when all 4 fail does the function throw, triggering QStash's automatic retry (3 attempts). Exhausted retries land in DLQ → `status: rejected`.
4. **Rate limiting at QStash** — QStash's built-in queue rate limiter throttles delivery to match the AI API's RPM cap. No custom rate-limiting code.
5. **Dispatch via Vercel Cron** — every minute, a dispatch function reads `pending` rows with `FOR UPDATE SKIP LOCKED`, publishes each to QStash, and updates status to `queued`. This avoids duplicate processing.

## Alternatives considered

- **DB as queue (self-built)** — Simpler dependency but requires ad-hoc locking, retry, and scheduling logic. Chosen against because QStash provides these for free with a ~$5/month cost for millions of messages.
- **Batch worker per function** — Higher throughput per invocation but doesn't fit Vercel Free's 10s timeout. Would require Pro ($20/month) or an external long-running worker.
- **AWS SQS / GCP Cloud Tasks** — Equivalent capability but none are native to Vercel. QStash is built by the same team behind Vercel's serverless infrastructure.

## Consequences

- Vercel Free tier function invocation limits (100K/month + 1M extra) become the bottleneck at extreme scale (~1.1M captions/month). Beyond that, upgrade to Pro or move workers to an external service.
- QStash introduces a vendor dependency; migration to another queue requires changing dispatch + worker endpoints.
- Monitoring QStash DLQ is essential — unattended failures silently accumulate.
