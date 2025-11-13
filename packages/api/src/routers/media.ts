import { db } from "@cyop/db";
import {
	datasets,
	mediaAssets,
	mediaStatusValues,
	requirements,
} from "@cyop/db/schema/platform";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";
import {
	buildPublicUrl,
	buildStorageKey,
	createPresignedUploadUrl,
	getStorageBucket,
} from "../services/storage";

const listInput = z
	.object({
		datasetId: z.number().int().positive().optional(),
		requirementId: z.number().int().positive().optional(),
	})
	.optional();

export const mediaRouter = router({
	list: protectedProcedure.input(listInput).query(async ({ input }) => {
		const conditions = [];
		if (input?.datasetId) {
			conditions.push(eq(mediaAssets.datasetId, input.datasetId));
		}
		if (input?.requirementId) {
			conditions.push(eq(mediaAssets.requirementId, input.requirementId));
		}

		const rows = await db
			.select({
				asset: mediaAssets,
				dataset: datasets,
				requirement: requirements,
			})
			.from(mediaAssets)
			.leftJoin(datasets, eq(mediaAssets.datasetId, datasets.id))
			.leftJoin(requirements, eq(mediaAssets.requirementId, requirements.id))
			.where(conditions.length ? and(...conditions) : undefined)
			.orderBy(desc(mediaAssets.createdAt));

		return rows.map(({ asset, dataset, requirement }) => ({
			...asset,
			dataset,
			requirement,
		}));
	}),

	requestUpload: protectedProcedure
		.input(
			z.object({
				datasetId: z.number().int().positive(),
				fileName: z.string().min(1),
				mimeType: z.string().optional(),
				size: z.number().int().nonnegative(),
			}),
		)
		.mutation(async ({ input }) => {
			const [datasetRow] = await db
				.select({
					id: datasets.id,
					requirementId: datasets.requirementId,
				})
				.from(datasets)
				.where(eq(datasets.id, input.datasetId))
				.limit(1);

			if (!datasetRow) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Dataset not found",
				});
			}

			const contentType =
				input.mimeType && input.mimeType.length > 0
					? input.mimeType
					: "application/octet-stream";
			const storageKey = buildStorageKey(input.datasetId, input.fileName);
			const publicUrl = buildPublicUrl(storageKey);
			const bucket = getStorageBucket();
			const now = new Date();

			const [asset] = await db
				.insert(mediaAssets)
				.values({
					datasetId: input.datasetId,
					requirementId: datasetRow.requirementId,
					originalName: input.fileName,
					mimeType: contentType,
					size: input.size,
					storageBucket: bucket,
					storageKey,
					publicUrl,
					status: "pending_upload",
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			if (!asset) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create upload session",
				});
			}

			const upload = createPresignedUploadUrl({
				key: storageKey,
				contentType,
			});

			return {
				asset,
				upload,
			};
		}),

	finalizeUpload: protectedProcedure
		.input(
			z.object({
				assetId: z.number().int().positive(),
				size: z.number().int().nonnegative().optional(),
				width: z.number().int().nonnegative().optional(),
				height: z.number().int().nonnegative().optional(),
				checksum: z.string().optional(),
				status: z.enum(mediaStatusValues).default("uploaded"),
			}),
		)
		.mutation(async ({ input }) => {
			const updates: Record<string, unknown> = {
				status: input.status,
				uploadedAt: new Date(),
				updatedAt: new Date(),
			};

			if (typeof input.size !== "undefined") {
				updates.size = input.size;
			}
			if (typeof input.width !== "undefined") {
				updates.width = input.width;
			}
			if (typeof input.height !== "undefined") {
				updates.height = input.height;
			}
			if (typeof input.checksum !== "undefined") {
				updates.checksum = input.checksum;
			}

			const [asset] = await db
				.update(mediaAssets)
				.set(updates)
				.where(eq(mediaAssets.id, input.assetId))
				.returning();

			if (!asset) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Asset not found",
				});
			}

			return asset;
		}),
});
