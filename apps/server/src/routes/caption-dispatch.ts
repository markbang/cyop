import { logger } from "@cyop/api/services/logger";
import { publishCaptionJob } from "@cyop/api/services/qstash";
import { db } from "@cyop/db";
import { and, eq, inArray } from "@cyop/db/drizzle-orm";
import { captions, mediaAssets } from "@cyop/db/schema/platform";
import type { Context } from "hono";

export async function captionDispatch(c: Context) {
	const start = Date.now();

	// Find up to 50 pending captions that have images with public URLs
	const rows = await db
		.select({ id: captions.id })
		.from(captions)
		.innerJoin(mediaAssets, eq(captions.mediaAssetId, mediaAssets.id))
		.where(and(eq(captions.status, "pending")))
		.limit(50);

	if (rows.length === 0) {
		return c.json({ dispatched: 0, ms: Date.now() - start });
	}

	const ids = rows.map((r) => r.id);

	// Optimistic lock: only update rows still in "pending" status
	const updated = await db
		.update(captions)
		.set({
			status: "queued",
			queuedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(and(inArray(captions.id, ids), eq(captions.status, "pending")))
		.returning({ id: captions.id });

	logger.info("Dispatch run", {
		candidates: rows.length,
		locked: updated.length,
		ms: Date.now() - start,
	});

	// Publish each locked caption to QStash
	let published = 0;
	for (const row of updated) {
		const ok = await publishCaptionJob(row.id);
		if (ok) published++;
	}

	return c.json({
		dispatched: updated.length,
		published,
		ms: Date.now() - start,
	});
}
