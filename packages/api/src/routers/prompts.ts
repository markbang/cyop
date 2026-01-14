import { db } from "@cyop/db";
import { desc, eq } from "@cyop/db/drizzle-orm";
import { promptTemplates } from "@cyop/db/schema/platform";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { protectedProcedure, router } from "../index";

export const promptsRouter = router({
	list: protectedProcedure
		.input(
			z
				.object({
					activeOnly: z.boolean().default(false),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const conditions = [];

			if (input?.activeOnly) {
				conditions.push(eq(promptTemplates.isActive, true));
			}

			const rows = await db
				.select()
				.from(promptTemplates)
				.where(conditions.length ? conditions[0] : undefined)
				.orderBy(desc(promptTemplates.createdAt));

			return rows;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.query(async ({ input }) => {
			const [template] = await db
				.select()
				.from(promptTemplates)
				.where(eq(promptTemplates.id, input.id))
				.limit(1);

			if (!template) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Prompt template not found",
				});
			}

			return template;
		}),

	getDefault: protectedProcedure.query(async () => {
		const [template] = await db
			.select()
			.from(promptTemplates)
			.where(eq(promptTemplates.isDefault, true))
			.limit(1);

		return template ?? null;
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(255),
				description: z.string().optional(),
				systemPrompt: z.string().min(1),
				userPromptTemplate: z.string().min(1),
				model: z.string().default("gpt-4o"),
				maxTokens: z.number().int().positive().max(4096).default(500),
				temperature: z.number().int().min(0).max(100).default(70),
				isDefault: z.boolean().default(false),
				isActive: z.boolean().default(true),
			}),
		)
		.mutation(async ({ input }) => {
			if (input.isDefault) {
				await db
					.update(promptTemplates)
					.set({ isDefault: false, updatedAt: new Date() })
					.where(eq(promptTemplates.isDefault, true));
			}

			const now = new Date();
			const [template] = await db
				.insert(promptTemplates)
				.values({
					...input,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			return template;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.number().int().positive(),
				name: z.string().min(1).max(255).optional(),
				description: z.string().optional(),
				systemPrompt: z.string().min(1).optional(),
				userPromptTemplate: z.string().min(1).optional(),
				model: z.string().optional(),
				maxTokens: z.number().int().positive().max(4096).optional(),
				temperature: z.number().int().min(0).max(100).optional(),
				isDefault: z.boolean().optional(),
				isActive: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const { id, ...updates } = input;

			if (updates.isDefault === true) {
				await db
					.update(promptTemplates)
					.set({ isDefault: false, updatedAt: new Date() })
					.where(eq(promptTemplates.isDefault, true));
			}

			const setValues: Record<string, unknown> = { updatedAt: new Date() };

			for (const [key, value] of Object.entries(updates)) {
				if (value !== undefined) {
					setValues[key] = value;
				}
			}

			const [template] = await db
				.update(promptTemplates)
				.set(setValues)
				.where(eq(promptTemplates.id, id))
				.returning();

			if (!template) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Prompt template not found",
				});
			}

			return template;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			const [deleted] = await db
				.delete(promptTemplates)
				.where(eq(promptTemplates.id, input.id))
				.returning({ id: promptTemplates.id });

			if (!deleted) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Prompt template not found",
				});
			}

			return { success: true };
		}),

	setDefault: protectedProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			await db
				.update(promptTemplates)
				.set({ isDefault: false, updatedAt: new Date() })
				.where(eq(promptTemplates.isDefault, true));

			const [template] = await db
				.update(promptTemplates)
				.set({ isDefault: true, updatedAt: new Date() })
				.where(eq(promptTemplates.id, input.id))
				.returning();

			if (!template) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Prompt template not found",
				});
			}

			return template;
		}),
});
