import { db } from "@cyop/db";
import { and, desc, eq } from "@cyop/db/drizzle-orm";
import { aiModels, aiModelTypeValues } from "@cyop/db/schema/platform";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { protectedProcedure, router } from "../index";

const modelInput = z.object({
	name: z.string().min(2),
	provider: z.string().min(2),
	modelName: z.string().min(1),
	type: z.enum(aiModelTypeValues).default("caption"),
	baseUrl: z.string().url().optional(),
	apiKeyEnv: z.string().min(1).optional(),
	defaultModel: z.boolean().default(false),
	enabled: z.boolean().default(true),
	metadata: z.record(z.string(), z.unknown()).default({}),
});

async function getModelById(id: number) {
	const [record] = await db
		.select()
		.from(aiModels)
		.where(eq(aiModels.id, id))
		.limit(1);
	if (!record) {
		throw new TRPCError({ code: "NOT_FOUND", message: "模型不存在" });
	}
	return record;
}

export const modelsRouter = router({
	list: protectedProcedure
		.input(
			z
				.object({
					type: z.enum(aiModelTypeValues).optional(),
					enabled: z.boolean().optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const conditions = [];
			if (input?.type) {
				conditions.push(eq(aiModels.type, input.type));
			}
			if (typeof input?.enabled === "boolean") {
				conditions.push(eq(aiModels.enabled, input.enabled));
			}

			const records = await db
				.select()
				.from(aiModels)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(aiModels.defaultModel), desc(aiModels.updatedAt));
			return records;
		}),

	create: protectedProcedure.input(modelInput).mutation(async ({ input }) => {
		if (input.defaultModel) {
			await db
				.update(aiModels)
				.set({ defaultModel: false })
				.where(eq(aiModels.type, input.type));
		}
		const [record] = await db
			.insert(aiModels)
			.values({
				...input,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();
		return record;
	}),

	update: protectedProcedure
		.input(
			modelInput
				.partial()
				.extend({
					id: z.number().int().positive(),
				})
				.refine((data) => Object.keys(data).length > 1, "请提供要更新的字段"),
		)
		.mutation(async ({ input }) => {
			const { id, defaultModel, ...rest } = input;
			const current = await getModelById(id);
			const nextType = rest.type ?? current.type;

			if (defaultModel === true) {
				await db
					.update(aiModels)
					.set({ defaultModel: false })
					.where(eq(aiModels.type, nextType));
			}
			const [record] = await db
				.update(aiModels)
				.set({
					...rest,
					defaultModel: defaultModel ?? undefined,
					updatedAt: new Date(),
				})
				.where(eq(aiModels.id, id))
				.returning();
			return record;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			await db.delete(aiModels).where(eq(aiModels.id, input.id));
			return { success: true };
		}),

	setDefault: protectedProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			const target = await getModelById(input.id);

			await db
				.update(aiModels)
				.set({ defaultModel: false })
				.where(eq(aiModels.type, target.type));

			const [record] = await db
				.update(aiModels)
				.set({ defaultModel: true, enabled: true, updatedAt: new Date() })
				.where(eq(aiModels.id, input.id))
				.returning();
			return record;
		}),
});
