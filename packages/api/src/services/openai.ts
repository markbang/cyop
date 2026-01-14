const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

type CaptionRequest = {
	imageUrl: string;
	systemPrompt: string;
	userPrompt: string;
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

function getApiKey(): string {
	const key = env.OPENAI_API_KEY;
	if (!key) {
		throw new Error("OPENAI_API_KEY is not configured");
	}
	return key;
}

export async function generateCaption(
	request: CaptionRequest,
): Promise<CaptionResult> {
	const apiKey = getApiKey();
	const model = request.model || "gpt-4o";
	const maxTokens = request.maxTokens || 500;
	const temperature = request.temperature ?? 0.7;

	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			temperature,
			messages: [
				{
					role: "system",
					content: request.systemPrompt,
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: request.userPrompt,
						},
						{
							type: "image_url",
							image_url: {
								url: request.imageUrl,
								detail: "high",
							},
						},
					],
				},
			],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
	}

	const data = (await response.json()) as {
		choices: Array<{ message: { content: string }; finish_reason: string }>;
		usage: { total_tokens: number };
		model: string;
	};

	const content = data.choices[0]?.message?.content;
	if (!content) {
		throw new Error("OpenAI returned empty response");
	}

	const finishReason = data.choices[0]?.finish_reason;
	const confidence = finishReason === "stop" ? 90 : 70;

	return {
		caption: content.trim(),
		model: data.model,
		tokensUsed: data.usage?.total_tokens || 0,
		confidence,
	};
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

type BatchCaptionResult = {
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

	const workers = Array.from({ length: concurrency }, () => worker());
	await Promise.all(workers);

	return results;
}
