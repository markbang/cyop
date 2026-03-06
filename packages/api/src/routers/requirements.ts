import { db } from "@cyop/db";
import { desc, eq } from "@cyop/db/drizzle-orm";
import {
	automationTasks,
	datasets,
	requirementPriorityValues,
	requirementStatusValues,
	requirements,
} from "@cyop/db/schema/platform";
import z from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";

const requirementBaseInput = z.object({
	title: z.string().min(2),
	description: z.string().min(4),
	owner: z.string().min(1),
	team: z.string().min(1),
	priority: z.enum(requirementPriorityValues),
	status: z.enum(requirementStatusValues).optional(),
	expectedImages: z.number().int().nonnegative().default(0),
	aiCoverageTarget: z.number().int().min(0).max(100).default(80),
	tagHints: z.array(z.string()).default([]),
	briefUrl: z.string().url().optional(),
	riskLevel: z.string().default("normal"),
	dueDate: z.coerce.date().optional(),
});

export const requirementsRouter = router({
	list: publicProcedure.query(async () => {
		return await db
			.select()
			.from(requirements)
			.orderBy(desc(requirements.updatedAt));
	}),

	create: protectedProcedure
		.input(requirementBaseInput)
		.mutation(async ({ input }) => {
			const now = new Date();
			const [record] = await db
				.insert(requirements)
				.values({
					title: input.title,
					description: input.description,
					owner: input.owner,
					team: input.team,
					status: input.status ?? "intake",
					priority: input.priority,
					expectedImages: input.expectedImages,
					aiCoverageTarget: input.aiCoverageTarget,
					tagHints: input.tagHints,
					briefUrl: input.briefUrl,
					riskLevel: input.riskLevel,
					dueDate: input.dueDate ?? null,
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			return record;
		}),

	updateStatus: protectedProcedure
		.input(
			z.object({
				id: z.number().int().positive(),
				status: z.enum(requirementStatusValues),
			}),
		)
		.mutation(async ({ input }) => {
			const [record] = await db
				.update(requirements)
				.set({
					status: input.status,
					updatedAt: new Date(),
				})
				.where(eq(requirements.id, input.id))
				.returning();
			return record;
		}),

	stats: publicProcedure.query(async () => {
		const [requirementRows, datasetRows, taskRows] = await Promise.all([
			db.select().from(requirements),
			db.select().from(datasets),
			db.select().from(automationTasks),
		]);

		const requirementStatusCounts = Object.fromEntries(
			requirementStatusValues.map((status) => [status, 0]),
		) as Record<(typeof requirementStatusValues)[number], number>;
		let urgentRequirements = 0;
		let blockedRequirements = 0;

		for (const requirement of requirementRows) {
			requirementStatusCounts[requirement.status] += 1;
			if (requirement.priority === "urgent") {
				urgentRequirements += 1;
			}
			if (requirement.status === "blocked") {
				blockedRequirements += 1;
			}
		}

		let automationSuccessDenominator = 0;
		let automationSuccessNumerator = 0;
		let runningTasks = 0;
		let blockedTasks = 0;

		for (const task of taskRows) {
			switch (task.status) {
				case "succeeded":
					automationSuccessDenominator += 1;
					automationSuccessNumerator += 1;
					break;
				case "failed":
					automationSuccessDenominator += 1;
					break;
				case "running":
					runningTasks += 1;
					break;
				case "blocked":
					blockedTasks += 1;
					break;
				default:
					break;
			}
		}

		let totalAiCaptionCoverage = 0;
		let totalAutoTagCoverage = 0;
		let totalReviewCoverage = 0;

		for (const dataset of datasetRows) {
			totalAiCaptionCoverage += dataset.aiCaptionCoverage;
			totalAutoTagCoverage += dataset.autoTagCoverage;
			totalReviewCoverage += dataset.reviewCoverage;
		}

		const average = (total: number, count: number) => {
			if (count === 0) {
				return 0;
			}
			return Math.round(total / count);
		};

		return {
			totals: {
				requirements: requirementRows.length,
				datasets: datasetRows.length,
				automationTasks: taskRows.length,
			},
			statusBreakdown: requirementStatusValues.map((status) => ({
				status,
				count: requirementStatusCounts[status],
			})),
			coverage: {
				aiCaption: average(totalAiCaptionCoverage, datasetRows.length),
				autoTag: average(totalAutoTagCoverage, datasetRows.length),
				review: average(totalReviewCoverage, datasetRows.length),
			},
			automation: {
				successRate:
					automationSuccessDenominator === 0
						? 0
						: Math.round(
								(automationSuccessNumerator / automationSuccessDenominator) *
									100,
							),
				running: runningTasks,
				blocked: blockedTasks,
			},
			alerts: {
				urgent: urgentRequirements,
				blocked: blockedRequirements,
			},
		};
	}),
});
