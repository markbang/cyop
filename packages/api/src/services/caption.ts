import type { aiModels } from "@cyop/db/schema/platform";
import { logger } from "./logger";

type CaptionModel = typeof aiModels.$inferSelect;

type CaptionJob = {
	imageUrl: string;
	systemPrompt?: string;
	userPrompt?: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
};

type CaptionResult = {
	caption: string;
	model: string;
	tokensUsed: number;
	confidence: number;
};

const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

function resolveApiKey(model?: CaptionModel): string {
	if (model?.apiKeyEnv && env[model.apiKeyEnv]) {
		return env[model.apiKeyEnv] as string;
	}
	if (env.AI_CAPTION_API_KEY) {
		return env.AI_CAPTION_API_KEY as string;
	}
	throw new Error(
		"Missing API key. Set AI_CAPTION_API_KEY or configure model-specific apiKeyEnv.",
	);
}

function resolveBaseUrl(model?: CaptionModel): string {
	if (model?.baseUrl) {
		return model.baseUrl.replace(/\/$/, "");
	}
	if (env.AI_CAPTION_BASE_URL) {
		return (env.AI_CAPTION_BASE_URL as string).replace(/\/$/, "");
	}
	return "https://api.openai.com/v1";
}

function resolveModelName(model?: CaptionModel): string {
	if (model?.modelName) {
		return model.modelName;
	}
	if (env.AI_CAPTION_MODEL) {
		return env.AI_CAPTION_MODEL as string;
	}
	return "gpt-4o-mini";
}

async function callCaptionApi(
	job: CaptionJob,
	modelOverride?: CaptionModel,
	attempt = 1,
): Promise<CaptionResult> {
	const apiKey = resolveApiKey(modelOverride);
	const baseUrl = resolveBaseUrl(modelOverride);
	const modelName = job.model || resolveModelName(modelOverride);
	const systemPrompt =
		job.systemPrompt ||
		(env.AI_CAPTION_PROMPT as string | undefined) ||
		"You are an expert image analyst. Describe the image in detail.";
	const userPrompt = job.userPrompt || "Please describe this image in detail.";
	const maxTokens = job.maxTokens || 500;
	const temperature = job.temperature ?? 0.7;

	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: modelName,
			max_tokens: maxTokens,
			temperature,
			messages: [
				{ role: "system", content: systemPrompt },
				{
					role: "user",
					content: [
						{ type: "text", text: userPrompt },
						{
							type: "image_url",
							image_url: { url: job.imageUrl, detail: "high" },
						},
					],
				},
			],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		const status = response.status;

		// Retry on rate limits and server errors
		if ((status === 429 || status >= 500) && attempt < 4) {
			const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
			logger.warn("Caption API retry", {
				status,
				attempt,
				delay,
				model: modelName,
			});
			await new Promise((resolve) => setTimeout(resolve, delay));
			return callCaptionApi(job, modelOverride, attempt + 1);
		}

		throw new Error(`Caption API error ${status}: ${errorText.slice(0, 200)}`);
	}

	const data = (await response.json()) as {
		choices: Array<{ message: { content: string }; finish_reason: string }>;
		usage: { total_tokens?: number };
		model: string;
	};

	const caption = data.choices[0]?.message?.content?.trim();
	if (!caption) {
		throw new Error("Caption API returned empty response");
	}

	const finishReason = data.choices[0]?.finish_reason;
	const confidence = finishReason === "stop" ? 90 : 70;

	return {
		caption,
		model: data.model,
		tokensUsed: data.usage?.total_tokens || 0,
		confidence,
	};
}

export async function generateCaption(
	job: CaptionJob,
	modelOverride?: CaptionModel,
): Promise<CaptionResult> {
	const startTime = Date.now();
	try {
		const result = await callCaptionApi(job, modelOverride);
		logger.info("Caption generated", {
			model: result.model,
			tokens: result.tokensUsed,
			confidence: result.confidence,
			durationMs: Date.now() - startTime,
		});
		return result;
	} catch (error) {
		logger.error("Caption generation failed", {
			durationMs: Date.now() - startTime,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		throw error;
	}
}

type BatchCaptionJob = {
	captionId: number;
	imageUrl: string;
	systemPrompt: string;
	userPrompt: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
};

export type BatchCaptionResult = {
	captionId: number;
	success: boolean;
	caption?: string;
	model?: string;
	tokensUsed?: number;
	confidence?: number;
	error?: string;
};

export async function generateCaptionsBatch(
	jobs: BatchCaptionJob[],
	concurrency = 3,
): Promise<BatchCaptionResult[]> {
	const results: BatchCaptionResult[] = [];
	const queue = [...jobs];

	async function worker() {
		while (queue.length > 0) {
			const job = queue.shift();
			if (!job) break;

			try {
				const result = await generateCaption({
					imageUrl: job.imageUrl,
					systemPrompt: job.systemPrompt,
					userPrompt: job.userPrompt,
					model: job.model,
					maxTokens: job.maxTokens,
					temperature: job.temperature,
				});

				results.push({
					captionId: job.captionId,
					success: true,
					caption: result.caption,
					model: result.model,
					tokensUsed: result.tokensUsed,
					confidence: result.confidence,
				});
			} catch (error) {
				results.push({
					captionId: job.captionId,
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}
	}

	await Promise.all(Array.from({ length: concurrency }, () => worker()));

	return results;
}
