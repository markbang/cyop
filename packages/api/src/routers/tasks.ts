import { db } from "@cyop/db";
import {
	automationTasks,
	datasets,
	requirements,
	taskStatusValues,
	taskTypeValues,
} from "@cyop/db/schema/platform";
import { desc, eq } from "drizzle-orm";
import z from "zod";

import { router, publicProcedure } from "../index";

const taskBaseInput = z.object({
	datasetId: z.number().int().positive(),
	type: z.enum(taskTypeValues),
	status: z.enum(taskStatusValues).default("queued"),
	progress: z.number().int().min(0).max(100).default(0),
	assignedTo: z.string().optional(),
	metadata: z
		.record(z.string(), z.unknown())
		.default({})
		.transform((value) => value ?? {}),
});

export const tasksRouter = router({
	list: publicProcedure.query(async () => {
		const rows = await db
			.select({
				task: automationTasks,
				dataset: datasets,
				requirement: requirements,
			})
			.from(automationTasks)
			.leftJoin(datasets, eq(automationTasks.datasetId, datasets.id))
			.leftJoin(requirements, eq(datasets.requirementId, requirements.id))
			.orderBy(desc(automationTasks.updatedAt));

		return rows.map(({ task, dataset, requirement }) => ({
			...task,
			dataset,
			requirement,
		}));
	}),

	create: publicProcedure.input(taskBaseInput).mutation(async ({ input }) => {
		const now = new Date();
		const [record] = await db
			.insert(automationTasks)
			.values({
				datasetId: input.datasetId,
				type: input.type,
				status: input.status,
				progress: input.progress,
				assignedTo: input.assignedTo,
				metadata: input.metadata,
				createdAt: now,
				updatedAt: now,
				startedAt: input.status === "running" ? now : null,
				completedAt:
					input.status === "succeeded" || input.status === "failed" ? now : null,
			})
			.returning();
		return record;
	}),

	updateStatus: publicProcedure
		.input(
			z.object({
				id: z.number().int().positive(),
				status: z.enum(taskStatusValues),
				progress: z.number().int().min(0).max(100).optional(),
				failureReason: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const now = new Date();
			const updates: Record<string, unknown> = {
				status: input.status,
				progress: input.progress ?? (input.status === "succeeded" ? 100 : 0),
				failureReason: input.failureReason,
				updatedAt: now,
			};
			if (input.status === "running") {
				updates.startedAt = now;
				updates.completedAt = null;
			} else if (input.status === "succeeded" || input.status === "failed") {
				updates.completedAt = now;
			} else if (input.status === "queued" || input.status === "paused") {
				updates.completedAt = null;
			}
			const [record] = await db
				.update(automationTasks)
				.set(updates)
				.where(eq(automationTasks.id, input.id))
				.returning();
			return record;
		}),
});
