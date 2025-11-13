import { db } from "@cyop/db";
import {
	automationTasks,
	datasets,
	requirementPriorityValues,
	requirementStatusValues,
	requirements,
} from "@cyop/db/schema/platform";
import { desc, eq } from "drizzle-orm";
import z from "zod";

import { router, publicProcedure } from "../index";

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

	create: publicProcedure.input(requirementBaseInput).mutation(async ({ input }) => {
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

	updateStatus: publicProcedure
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

		const statusBreakdown = requirementStatusValues.map((status) => ({
			status,
			count: requirementRows.filter((req) => req.status === status).length,
		}));

		const automationSuccessDenominator = taskRows.filter((task) =>
			["succeeded", "failed"].includes(task.status),
		).length;
		const automationSuccessNumerator = taskRows.filter(
			(task) => task.status === "succeeded",
		).length;

		const average = (values: number[]) => {
			if (values.length === 0) {
				return 0;
			}
			return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
		};

		return {
			totals: {
				requirements: requirementRows.length,
				datasets: datasetRows.length,
				automationTasks: taskRows.length,
			},
			statusBreakdown,
			coverage: {
				aiCaption: average(datasetRows.map((row) => row.aiCaptionCoverage)),
				autoTag: average(datasetRows.map((row) => row.autoTagCoverage)),
				review: average(datasetRows.map((row) => row.reviewCoverage)),
			},
			automation: {
				successRate:
					automationSuccessDenominator === 0
						? 0
						: Math.round(
								(automationSuccessNumerator / automationSuccessDenominator) * 100,
							),
				running: taskRows.filter((task) => task.status === "running").length,
				blocked: taskRows.filter((task) => task.status === "blocked").length,
			},
			alerts: {
				urgent: requirementRows.filter((req) => req.priority === "urgent").length,
				blocked: requirementRows.filter((req) => req.status === "blocked").length,
			},
		};
	}),
});
