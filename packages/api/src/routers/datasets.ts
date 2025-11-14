import { db } from "@cyop/db";
import { desc, eq } from "@cyop/db/drizzle-orm";
import { datasets, requirements } from "@cyop/db/schema/platform";
import z from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { publishAutomationEvent } from "../services/automation";

const datasetBaseInput = z.object({
	requirementId: z.number().int().positive(),
	name: z.string().min(2),
	storageBucket: z.string().min(2),
	imageCount: z.number().int().nonnegative().default(0),
	processedCount: z.number().int().nonnegative().default(0),
	pendingCount: z.number().int().nonnegative().optional(),
	aiCaptionCoverage: z.number().int().min(0).max(100).default(0),
	autoTagCoverage: z.number().int().min(0).max(100).default(0),
	reviewCoverage: z.number().int().min(0).max(100).default(0),
	focusTags: z.array(z.string()).default([]),
	lastRunAt: z.coerce.date().optional(),
});

export const datasetsRouter = router({
	list: publicProcedure.query(async () => {
		const rows = await db
			.select({
				dataset: datasets,
				requirement: requirements,
			})
			.from(datasets)
			.leftJoin(requirements, eq(datasets.requirementId, requirements.id))
			.orderBy(desc(datasets.updatedAt));

		return rows.map(({ dataset, requirement }) => ({
			...dataset,
			requirement,
		}));
	}),

	create: protectedProcedure
		.input(datasetBaseInput)
		.mutation(async ({ input }) => {
			const now = new Date();
			const derivedPending =
				input.pendingCount ??
				Math.max(input.imageCount - input.processedCount, 0);
			const [record] = await db
				.insert(datasets)
				.values({
					requirementId: input.requirementId,
					name: input.name,
					storageBucket: input.storageBucket,
					imageCount: input.imageCount,
					processedCount: input.processedCount,
					pendingCount: derivedPending,
					aiCaptionCoverage: input.aiCaptionCoverage,
					autoTagCoverage: input.autoTagCoverage,
					reviewCoverage: input.reviewCoverage,
					focusTags: input.focusTags,
					lastRunAt: input.lastRunAt ?? null,
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			if (!record) {
				throw new Error("Failed to create dataset");
			}
			await publishAutomationEvent({
				type: "dataset.created",
				datasetId: record.id,
				requirementId: record.requirementId,
				focusTags: record.focusTags,
				targetCoverage: {
					caption: record.aiCaptionCoverage,
					tag: record.autoTagCoverage,
				},
			});

			return record;
		}),

	updateMetrics: protectedProcedure
		.input(
			z.object({
				id: z.number().int().positive(),
				imageCount: z.number().int().nonnegative(),
				processedCount: z.number().int().nonnegative(),
				pendingCount: z.number().int().nonnegative().optional(),
				aiCaptionCoverage: z.number().int().min(0).max(100),
				autoTagCoverage: z.number().int().min(0).max(100),
				reviewCoverage: z.number().int().min(0).max(100),
			}),
		)
		.mutation(async ({ input }) => {
			const derivedPending =
				input.pendingCount ??
				Math.max(input.imageCount - input.processedCount, 0);
			const [record] = await db
				.update(datasets)
				.set({
					imageCount: input.imageCount,
					processedCount: input.processedCount,
					pendingCount: derivedPending,
					aiCaptionCoverage: input.aiCaptionCoverage,
					autoTagCoverage: input.autoTagCoverage,
					reviewCoverage: input.reviewCoverage,
					updatedAt: new Date(),
				})
				.where(eq(datasets.id, input.id))
				.returning();
			if (!record) {
				throw new Error("Failed to update dataset metrics");
			}
			await publishAutomationEvent({
				type: "dataset.metrics_updated",
				datasetId: record.id,
				imageCount: record.imageCount,
				processedCount: record.processedCount,
				pendingCount: record.pendingCount,
				coverage: {
					caption: record.aiCaptionCoverage,
					tag: record.autoTagCoverage,
					review: record.reviewCoverage,
				},
			});

			return record;
		}),
});
