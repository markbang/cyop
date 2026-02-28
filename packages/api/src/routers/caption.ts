import { db } from "@cyop/db";
import { and, desc, eq, inArray } from "@cyop/db/drizzle-orm";
import {
	aiModels,
	captionJobStatusValues,
	captionJobs,
	datasets,
	mediaAssets,
	type mediaStatusValues,
} from "@cyop/db/schema/platform";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { protectedProcedure, router } from "../index";
import { generateCaption } from "../services/caption";

const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

async function resolveModel(modelId?: number) {
	if (modelId) {
		const [model] = await db
			.select()
			.from(aiModels)
			.where(and(eq(aiModels.id, modelId), eq(aiModels.type, "caption")))
			.limit(1);
		if (!model) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "找不到指定的 caption 模型",
			});
		}
		if (!model.enabled) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "模型已被禁用" });
		}
		return model;
	}

	const [model] = await db
		.select()
		.from(aiModels)
		.where(and(eq(aiModels.type, "caption"), eq(aiModels.enabled, true)))
		.orderBy(desc(aiModels.defaultModel), desc(aiModels.updatedAt))
		.limit(1);
	if (model) {
		return model;
	}
	if (env.AI_CAPTION_MODEL || env.AI_CAPTION_API_KEY) {
		return {
			id: 0,
			name: "Env default",
			provider: "openai-compatible",
			modelName: env.AI_CAPTION_MODEL || "gpt-4o-mini",
			type: "caption" as const,
			baseUrl: (env.AI_CAPTION_BASE_URL as string | undefined) ?? null,
			apiKeyEnv: "AI_CAPTION_API_KEY",
			defaultModel: true,
			enabled: true,
			metadata: {} as Record<string, unknown>,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
	}
	throw new TRPCError({
		code: "NOT_FOUND",
		message: "未配置可用的 caption 模型，请先创建模型或设置环境变量",
	});
}

export const captionRouter = router({
	generate: protectedProcedure
		.input(
			z
				.object({
					modelId: z.number().int().positive().optional(),
					assetId: z.number().int().positive().optional(),
					imageUrl: z.string().url().optional(),
					prompt: z.string().optional(),
				})
				.refine((val) => Boolean(val.assetId || val.imageUrl), {
					message: "assetId 或 imageUrl 至少提供一个",
				}),
		)
		.mutation(async ({ input, ctx }) => {
			const model = await resolveModel(input.modelId);
			let imageUrl = input.imageUrl;
			let datasetId: number | null = null;
			let assetId: number | null = null;

			if (input.assetId) {
				const [asset] = await db
					.select()
					.from(mediaAssets)
					.where(eq(mediaAssets.id, input.assetId))
					.limit(1);
				if (!asset) {
					throw new TRPCError({ code: "NOT_FOUND", message: "素材不存在" });
				}
				if (!asset.publicUrl) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "素材缺少可访问的 URL",
					});
				}
				imageUrl = asset.publicUrl;
				datasetId = asset.datasetId;
				assetId = asset.id;
			}

			if (!imageUrl) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "无法解析图片地址",
				});
			}

			const result = await generateCaption({
				imageUrl,
				prompt: input.prompt,
				model,
			});

			const [job] = await db
				.insert(captionJobs)
				.values({
					datasetId,
					assetId,
					modelId: model.id || null,
					imageUrl,
					prompt: input.prompt,
					caption: result.caption,
					status: "succeeded",
					metadata: { invokedBy: ctx.session?.user?.email },
					startedAt: new Date(),
					completedAt: new Date(),
					updatedAt: new Date(),
				})
				.returning();

			return { caption: result.caption, job };
		}),

	enqueueBatch: protectedProcedure
		.input(
			z.object({
				datasetId: z.number().int().positive(),
				modelId: z.number().int().positive().optional(),
				limit: z.number().int().min(1).max(500).default(50),
				statusFilter: z.enum(["uploaded", "ready", "processing"]).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const model = await resolveModel(input.modelId);
			const conditions = [eq(mediaAssets.datasetId, input.datasetId)];
			const allowedStatuses: Array<(typeof mediaStatusValues)[number]> = [
				"uploaded",
				"ready",
				"processing",
			];
			const filter: Array<(typeof mediaStatusValues)[number]> =
				input.statusFilter ? [input.statusFilter] : allowedStatuses;
			conditions.push(inArray(mediaAssets.status, filter));

			const assets = await db
				.select()
				.from(mediaAssets)
				.where(and(...conditions))
				.limit(input.limit);

			if (!assets.length) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "没有可批处理的素材",
				});
			}

			const now = new Date();
			const jobsToInsert: Array<typeof captionJobs.$inferInsert> = [];
			let skippedMissingUrl = 0;

			for (const asset of assets) {
				if (!asset.publicUrl) {
					skippedMissingUrl += 1;
					continue;
				}
				jobsToInsert.push({
					datasetId: asset.datasetId,
					assetId: asset.id,
					modelId: model.id || null,
					imageUrl: asset.publicUrl,
					status: "queued",
					metadata: {
						requestedBy: ctx.session?.user?.email,
					},
					createdAt: now,
					updatedAt: now,
				});
			}

			if (!jobsToInsert.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "素材均缺少可访问的 URL，无法创建任务",
				});
			}

			await db.insert(captionJobs).values(jobsToInsert);

			return {
				count: jobsToInsert.length,
				skippedMissingUrl,
				modelId: model.id,
			};
		}),

	processQueued: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().int().min(1).max(100).default(20),
					modelId: z.number().int().positive().optional(),
				})
				.optional(),
		)
		.mutation(async ({ input }) => {
			const limit = input?.limit ?? 20;

			const queuedJobs = await db
				.select()
				.from(captionJobs)
				.where(eq(captionJobs.status, "queued"))
				.orderBy(desc(captionJobs.createdAt))
				.limit(limit);

			if (!queuedJobs.length) {
				return { processed: 0, succeeded: 0, failed: 0 };
			}

			let succeeded = 0;
			let failed = 0;

			for (const job of queuedJobs) {
				const startedAt = new Date();
				await db
					.update(captionJobs)
					.set({
						status: "running",
						startedAt,
						updatedAt: startedAt,
					})
					.where(eq(captionJobs.id, job.id));

				try {
					if (!job.imageUrl) {
						throw new Error("任务缺少 imageUrl");
					}

					const model = await resolveModel(job.modelId ?? input?.modelId);
					const result = await generateCaption({
						imageUrl: job.imageUrl,
						prompt: job.prompt ?? undefined,
						model,
					});
					const completedAt = new Date();

					await db
						.update(captionJobs)
						.set({
							status: "succeeded",
							modelId: model.id || null,
							caption: result.caption,
							error: null,
							completedAt,
							updatedAt: completedAt,
						})
						.where(eq(captionJobs.id, job.id));

					succeeded += 1;
				} catch (error) {
					const completedAt = new Date();
					const errorText =
						error instanceof Error ? error.message : "caption 任务处理失败";

					await db
						.update(captionJobs)
						.set({
							status: "failed",
							error: errorText,
							completedAt,
							updatedAt: completedAt,
						})
						.where(eq(captionJobs.id, job.id));

					failed += 1;
				}
			}

			return {
				processed: queuedJobs.length,
				succeeded,
				failed,
			};
		}),

	listJobs: protectedProcedure
		.input(
			z
				.object({
					datasetId: z.number().int().positive().optional(),
					assetId: z.number().int().positive().optional(),
					status: z.enum(captionJobStatusValues).optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const conditions = [];
			if (input?.datasetId) {
				conditions.push(eq(captionJobs.datasetId, input.datasetId));
			}
			if (input?.assetId) {
				conditions.push(eq(captionJobs.assetId, input.assetId));
			}
			if (input?.status) {
				conditions.push(eq(captionJobs.status, input.status));
			}

			const rows = await db
				.select({
					job: captionJobs,
					asset: mediaAssets,
					dataset: datasets,
					model: aiModels,
				})
				.from(captionJobs)
				.leftJoin(mediaAssets, eq(captionJobs.assetId, mediaAssets.id))
				.leftJoin(datasets, eq(captionJobs.datasetId, datasets.id))
				.leftJoin(aiModels, eq(captionJobs.modelId, aiModels.id))
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(captionJobs.updatedAt))
				.limit(200);

			return rows.map(({ job, asset, dataset, model }) => ({
				...job,
				asset,
				dataset,
				model,
			}));
		}),
});
