import { db } from "@cyop/db";
import { and, eq, isNotNull } from "@cyop/db/drizzle-orm";
import {
	captions,
	mediaAssets,
	promptTemplates,
} from "@cyop/db/schema/platform";
import { generateCaptionsBatch } from "./openai";

type ProcessResult = {
	processed: number;
	succeeded: number;
	failed: number;
	errors: Array<{ captionId: number; error: string }>;
};

export async function processPendingCaptions(
	limit = 10,
	concurrency = 3,
): Promise<ProcessResult> {
	const pendingCaptions = await db
		.select({
			captionId: captions.id,
			imageUrl: mediaAssets.publicUrl,
			systemPrompt: promptTemplates.systemPrompt,
			userPrompt: promptTemplates.userPromptTemplate,
			model: promptTemplates.model,
			maxTokens: promptTemplates.maxTokens,
			temperature: promptTemplates.temperature,
		})
		.from(captions)
		.innerJoin(mediaAssets, eq(captions.mediaAssetId, mediaAssets.id))
		.leftJoin(
			promptTemplates,
			eq(captions.promptTemplateId, promptTemplates.id),
		)
		.where(
			and(eq(captions.status, "processing"), isNotNull(mediaAssets.publicUrl)),
		)
		.limit(limit);

	if (pendingCaptions.length === 0) {
		return { processed: 0, succeeded: 0, failed: 0, errors: [] };
	}

	const defaultSystemPrompt =
		"You are an expert image analyst. Describe the image in detail, focusing on the main subject, composition, colors, and any notable elements.";
	const defaultUserPrompt = "Please describe this image in detail.";

	const jobs = pendingCaptions
		.filter((c): c is typeof c & { imageUrl: string } => c.imageUrl !== null)
		.map((c) => ({
			captionId: c.captionId,
			imageUrl: c.imageUrl,
			systemPrompt: c.systemPrompt || defaultSystemPrompt,
			userPrompt: c.userPrompt || defaultUserPrompt,
			model: c.model || "gpt-4o",
			maxTokens: c.maxTokens || 500,
			temperature: (c.temperature || 70) / 100,
		}));

	const results = await generateCaptionsBatch(jobs, concurrency);
	const errors: Array<{ captionId: number; error: string }> = [];
	let succeeded = 0;
	let failed = 0;

	for (const result of results) {
		if (result.success && result.caption) {
			await db
				.update(captions)
				.set({
					aiCaption: result.caption,
					finalCaption: result.caption,
					status: "completed",
					model: result.model,
					confidence: result.confidence,
					tokensUsed: result.tokensUsed,
					generatedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(captions.id, result.captionId));
			succeeded++;
		} else {
			await db
				.update(captions)
				.set({
					status: "rejected",
					rejectionReason: result.error || "Caption generation failed",
					updatedAt: new Date(),
				})
				.where(eq(captions.id, result.captionId));
			failed++;
			errors.push({
				captionId: result.captionId,
				error: result.error || "Unknown error",
			});
		}
	}

	return {
		processed: results.length,
		succeeded,
		failed,
		errors,
	};
}
