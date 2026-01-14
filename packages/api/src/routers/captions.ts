import { db } from "@cyop/db";
import { and, desc, eq, inArray, isNull, sql } from "@cyop/db/drizzle-orm";
import {
	captionStatusValues,
	captions,
	mediaAssets,
	promptTemplates,
} from "@cyop/db/schema/platform";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { protectedProcedure, router } from "../index";
import { publishAutomationEvent } from "../services/automation";
import { processPendingCaptions } from "../services/captionWorker";

const listInput = z
	.object({
		mediaAssetId: z.number().int().positive().optional(),
		datasetId: z.number().int().positive().optional(),
		status: z.enum(captionStatusValues).optional(),
		limit: z.number().int().positive().max(100).default(50),
		offset: z.number().int().nonnegative().default(0),
	})
	.optional();

export const captionsRouter = router({
	list: protectedProcedure.input(listInput).query(async ({ input }) => {
		const conditions = [];

		if (input?.mediaAssetId) {
			conditions.push(eq(captions.mediaAssetId, input.mediaAssetId));
		}
		if (input?.status) {
			conditions.push(eq(captions.status, input.status));
		}

		const query = db
			.select({
				caption: captions,
				mediaAsset: mediaAssets,
				promptTemplate: promptTemplates,
			})
			.from(captions)
			.leftJoin(mediaAssets, eq(captions.mediaAssetId, mediaAssets.id))
			.leftJoin(
				promptTemplates,
				eq(captions.promptTemplateId, promptTemplates.id),
			);

		if (input?.datasetId) {
			conditions.push(eq(mediaAssets.datasetId, input.datasetId));
		}

		const rows = await query
			.where(conditions.length ? and(...conditions) : undefined)
			.orderBy(desc(captions.createdAt))
			.limit(input?.limit ?? 50)
			.offset(input?.offset ?? 0);

		return rows.map(({ caption, mediaAsset, promptTemplate }) => ({
			...caption,
			mediaAsset,
			promptTemplate,
		}));
	}),

	getById: protectedProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.query(async ({ input }) => {
			const [row] = await db
				.select({
					caption: captions,
					mediaAsset: mediaAssets,
					promptTemplate: promptTemplates,
				})
				.from(captions)
				.leftJoin(mediaAssets, eq(captions.mediaAssetId, mediaAssets.id))
				.leftJoin(
					promptTemplates,
					eq(captions.promptTemplateId, promptTemplates.id),
				)
				.where(eq(captions.id, input.id))
				.limit(1);

			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Caption not found",
				});
			}

			return {
				...row.caption,
				mediaAsset: row.mediaAsset,
				promptTemplate: row.promptTemplate,
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				mediaAssetId: z.number().int().positive(),
				promptTemplateId: z.number().int().positive().optional(),
				manualCaption: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const [asset] = await db
				.select()
				.from(mediaAssets)
				.where(eq(mediaAssets.id, input.mediaAssetId))
				.limit(1);

			if (!asset) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Media asset not found",
				});
			}

			const now = new Date();
			const [caption] = await db
				.insert(captions)
				.values({
					mediaAssetId: input.mediaAssetId,
					promptTemplateId: input.promptTemplateId,
					manualCaption: input.manualCaption,
					finalCaption: input.manualCaption,
					status: input.manualCaption ? "completed" : "pending",
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			return caption;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.number().int().positive(),
				manualCaption: z.string().optional(),
				finalCaption: z.string().optional(),
				status: z.enum(captionStatusValues).optional(),
				rejectionReason: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const { id, ...updates } = input;

			const setValues: Record<string, unknown> = { updatedAt: new Date() };

			if (updates.manualCaption !== undefined) {
				setValues.manualCaption = updates.manualCaption;
			}
			if (updates.finalCaption !== undefined) {
				setValues.finalCaption = updates.finalCaption;
			}
			if (updates.status !== undefined) {
				setValues.status = updates.status;
				if (updates.status === "approved") {
					setValues.approvedAt = new Date();
				}
			}
			if (updates.rejectionReason !== undefined) {
				setValues.rejectionReason = updates.rejectionReason;
			}

			const [caption] = await db
				.update(captions)
				.set(setValues)
				.where(eq(captions.id, id))
				.returning();

			if (!caption) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Caption not found",
				});
			}

			return caption;
		}),

	approve: protectedProcedure
		.input(
			z.object({
				id: z.number().int().positive(),
				approvedBy: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [caption] = await db
				.update(captions)
				.set({
					status: "approved",
					approvedAt: new Date(),
					approvedBy: input.approvedBy ?? ctx.session.user.email ?? "unknown",
					updatedAt: new Date(),
				})
				.where(eq(captions.id, input.id))
				.returning();

			if (!caption) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Caption not found",
				});
			}

			return caption;
		}),

	reject: protectedProcedure
		.input(
			z.object({
				id: z.number().int().positive(),
				reason: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const [caption] = await db
				.update(captions)
				.set({
					status: "rejected",
					rejectionReason: input.reason,
					updatedAt: new Date(),
				})
				.where(eq(captions.id, input.id))
				.returning();

			if (!caption) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Caption not found",
				});
			}

			return caption;
		}),

	batchApprove: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.number().int().positive()).min(1),
				approvedBy: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const result = await db
				.update(captions)
				.set({
					status: "approved",
					approvedAt: new Date(),
					approvedBy: input.approvedBy ?? ctx.session.user.email ?? "unknown",
					updatedAt: new Date(),
				})
				.where(inArray(captions.id, input.ids))
				.returning({ id: captions.id });

			return { approved: result.length };
		}),

	batchReject: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.number().int().positive()).min(1),
				reason: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const result = await db
				.update(captions)
				.set({
					status: "rejected",
					rejectionReason: input.reason,
					updatedAt: new Date(),
				})
				.where(inArray(captions.id, input.ids))
				.returning({ id: captions.id });

			return { rejected: result.length };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			const [deleted] = await db
				.delete(captions)
				.where(eq(captions.id, input.id))
				.returning({ id: captions.id });

			if (!deleted) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Caption not found",
				});
			}

			return { success: true };
		}),

	stats: protectedProcedure
		.input(z.object({ datasetId: z.number().int().positive().optional() }))
		.query(async ({ input }) => {
			const baseQuery = input?.datasetId
				? db
						.select({
							status: captions.status,
							count: sql<number>`count(*)::int`,
						})
						.from(captions)
						.innerJoin(mediaAssets, eq(captions.mediaAssetId, mediaAssets.id))
						.where(eq(mediaAssets.datasetId, input.datasetId))
						.groupBy(captions.status)
				: db
						.select({
							status: captions.status,
							count: sql<number>`count(*)::int`,
						})
						.from(captions)
						.groupBy(captions.status);

			const rows = await baseQuery;

			const stats = {
				pending: 0,
				processing: 0,
				completed: 0,
				approved: 0,
				rejected: 0,
				total: 0,
			};

			for (const row of rows) {
				if (row.status in stats) {
					stats[row.status as keyof typeof stats] = row.count;
				}
				stats.total += row.count;
			}

			return stats;
		}),

	triggerCaptioning: protectedProcedure
		.input(
			z.object({
				datasetId: z.number().int().positive(),
				promptTemplateId: z.number().int().positive().optional(),
				mediaAssetIds: z.array(z.number().int().positive()).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const conditions = [eq(mediaAssets.datasetId, input.datasetId)];

			if (input.mediaAssetIds?.length) {
				conditions.push(inArray(mediaAssets.id, input.mediaAssetIds));
			}

			const assets = await db
				.select({ id: mediaAssets.id })
				.from(mediaAssets)
				.leftJoin(captions, eq(captions.mediaAssetId, mediaAssets.id))
				.where(and(...conditions, isNull(captions.id)));

			if (assets.length === 0) {
				return { queued: 0 };
			}

			let templateId = input.promptTemplateId;
			if (!templateId) {
				const [defaultTemplate] = await db
					.select({ id: promptTemplates.id })
					.from(promptTemplates)
					.where(eq(promptTemplates.isDefault, true))
					.limit(1);
				templateId = defaultTemplate?.id;
			}

			const now = new Date();
			const captionRecords = assets.map((asset) => ({
				mediaAssetId: asset.id,
				promptTemplateId: templateId,
				status: "processing" as const,
				createdAt: now,
				updatedAt: now,
			}));

			const inserted = await db
				.insert(captions)
				.values(captionRecords)
				.returning({ id: captions.id, mediaAssetId: captions.mediaAssetId });

			await publishAutomationEvent({
				type: "task.created",
				taskId: 0,
				datasetId: input.datasetId,
				taskType: "caption",
				status: "running",
				assignedTo: null,
			});

			return {
				queued: inserted.length,
				captionIds: inserted.map((c) => c.id),
			};
		}),

	export: protectedProcedure
		.input(
			z.object({
				datasetId: z.number().int().positive().optional(),
				format: z.enum(["json", "csv", "txt"]).default("json"),
				statusFilter: z.enum(captionStatusValues).optional(),
			}),
		)
		.query(async ({ input }) => {
			const conditions = [];

			if (input.datasetId) {
				conditions.push(eq(mediaAssets.datasetId, input.datasetId));
			}
			if (input.statusFilter) {
				conditions.push(eq(captions.status, input.statusFilter));
			}

			const rows = await db
				.select({
					id: captions.id,
					originalName: mediaAssets.originalName,
					publicUrl: mediaAssets.publicUrl,
					storageKey: mediaAssets.storageKey,
					aiCaption: captions.aiCaption,
					manualCaption: captions.manualCaption,
					finalCaption: captions.finalCaption,
					status: captions.status,
					model: captions.model,
					confidence: captions.confidence,
				})
				.from(captions)
				.innerJoin(mediaAssets, eq(captions.mediaAssetId, mediaAssets.id))
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(mediaAssets.originalName);

			if (input.format === "csv") {
				const header = "filename,caption,status,model,confidence";
				const lines = rows.map((r) => {
					const caption = (
						r.finalCaption ||
						r.manualCaption ||
						r.aiCaption ||
						""
					).replace(/"/g, '""');
					return `"${r.originalName}","${caption}","${r.status}","${r.model || ""}","${r.confidence || ""}"`;
				});
				return { format: "csv", data: [header, ...lines].join("\n") };
			}

			if (input.format === "txt") {
				const lines = rows.map((r) => {
					const baseName =
						r.originalName?.replace(/\.[^.]+$/, "") || `caption_${r.id}`;
					const caption =
						r.finalCaption || r.manualCaption || r.aiCaption || "";
					return { filename: `${baseName}.txt`, content: caption };
				});
				return { format: "txt", files: lines };
			}

			return { format: "json", data: rows };
		}),

	regenerate: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.number().int().positive()).min(1),
				promptTemplateId: z.number().int().positive().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const now = new Date();

			let templateId = input.promptTemplateId;
			if (!templateId) {
				const [defaultTemplate] = await db
					.select({ id: promptTemplates.id })
					.from(promptTemplates)
					.where(eq(promptTemplates.isDefault, true))
					.limit(1);
				templateId = defaultTemplate?.id;
			}

			await db
				.update(captions)
				.set({
					status: "processing",
					promptTemplateId: templateId,
					aiCaption: null,
					confidence: null,
					tokensUsed: null,
					generatedAt: null,
					updatedAt: now,
				})
				.where(inArray(captions.id, input.ids));

			return { regenerating: input.ids.length };
		}),

	processQueue: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().int().positive().max(50).default(10),
					concurrency: z.number().int().positive().max(10).default(3),
				})
				.optional(),
		)
		.mutation(async ({ input }) => {
			const result = await processPendingCaptions(
				input?.limit ?? 10,
				input?.concurrency ?? 3,
			);
			return result;
		}),
});
