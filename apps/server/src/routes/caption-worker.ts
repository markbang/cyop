import { generateCaption } from "@cyop/api/services/caption";
import { logger } from "@cyop/api/services/logger";
import { verifyQstashSignature } from "@cyop/api/services/qstash";
import { db } from "@cyop/db";
import { eq } from "@cyop/db/drizzle-orm";
import {
	captions,
	mediaAssets,
	promptTemplates,
} from "@cyop/db/schema/platform";
import type { Context } from "hono";

export async function captionWorker(c: Context) {
	const start = Date.now();

	// Verify QStash signature
	const signature = c.req.header("upstash-signature") ?? null;
	const rawBody = await c.req.raw.clone().text();
	const valid = await verifyQstashSignature(signature, rawBody);
	if (!valid) {
		return c.json({ error: "Invalid signature" }, 401);
	}

	const { captionId } = (await c.req.json()) as { captionId?: number };
	if (!captionId) {
		return c.json({ error: "Missing captionId" }, 400);
	}

	// Read caption + media asset + prompt template
	const [row] = await db
		.select({
			id: captions.id,
			mediaAssetId: captions.mediaAssetId,
			imageUrl: mediaAssets.publicUrl,
			systemPrompt: promptTemplates.systemPrompt,
			userPrompt: promptTemplates.userPromptTemplate,
			model: promptTemplates.model,
			maxTokens: promptTemplates.maxTokens,
			temperature: promptTemplates.temperature,
			retryCount: captions.retryCount,
		})
		.from(captions)
		.innerJoin(mediaAssets, eq(captions.mediaAssetId, mediaAssets.id))
		.leftJoin(
			promptTemplates,
			eq(captions.promptTemplateId, promptTemplates.id),
		)
		.where(eq(captions.id, captionId))
		.limit(1);

	if (!row) {
		return c.json({ error: "Caption not found" }, 404);
	}

	if (!row.imageUrl) {
		await db
			.update(captions)
			.set({
				status: "rejected",
				rejectionReason: "Missing public URL",
				updatedAt: new Date(),
			})
			.where(eq(captions.id, captionId));
		return c.json({ error: "Missing image URL" }, 400);
	}

	// Mark as processing
	await db
		.update(captions)
		.set({
			status: "processing",
			retryCount: (row.retryCount ?? 0) + 1,
			updatedAt: new Date(),
		})
		.where(eq(captions.id, captionId));

	try {
		const result = await generateCaption({
			imageUrl: row.imageUrl,
			systemPrompt: row.systemPrompt || undefined,
			userPrompt: row.userPrompt || undefined,
			model: row.model || undefined,
			maxTokens: row.maxTokens || undefined,
			temperature: row.temperature ? row.temperature / 100 : undefined,
		});

		const completedAt = new Date();
		await db
			.update(captions)
			.set({
				aiCaption: result.caption,
				finalCaption: result.caption,
				status: "completed",
				model: result.model,
				confidence: result.confidence,
				tokensUsed: result.tokensUsed,
				generatedAt: completedAt,
				updatedAt: completedAt,
			})
			.where(eq(captions.id, captionId));

		logger.info("Caption worker done", {
			captionId,
			model: result.model,
			ms: Date.now() - start,
		});

		return c.json({ success: true, captionId });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error("Caption worker failed", {
			captionId,
			error: errorMsg,
			retry: (row.retryCount ?? 0) + 1,
			ms: Date.now() - start,
		});

		// Update retry count, status stays "processing" so QStash will retry
		await db
			.update(captions)
			.set({
				processingError: errorMsg,
				updatedAt: new Date(),
			})
			.where(eq(captions.id, captionId));

		// Return non-200 so QStash retries
		return c.json({ error: errorMsg, captionId }, 500);
	}
}

export async function captionDlq(c: Context) {
	const signature = c.req.header("upstash-signature") ?? null;
	const rawBody = await c.req.raw.clone().text();
	const valid = await verifyQstashSignature(signature, rawBody);
	if (!valid) {
		return c.json({ error: "Invalid signature" }, 401);
	}

	const body = (await c.req.json()) as { captionId?: number };
	const captionId = body.captionId;

	if (!captionId) {
		return c.json({ error: "Missing captionId" }, 400);
	}

	await db
		.update(captions)
		.set({
			status: "rejected",
			rejectionReason: "Exhausted all retries (QStash DLQ)",
			updatedAt: new Date(),
		})
		.where(eq(captions.id, captionId));

	logger.error("Caption DLQ — exhausted retries", { captionId });

	return c.json({ success: true, captionId, dlq: true });
}
