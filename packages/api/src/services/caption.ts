import type { aiModels } from "@cyop/db/schema/platform";

type CaptionModel = typeof aiModels.$inferSelect;

type CaptionOptions = {
	imageUrl: string;
	prompt?: string;
	model: CaptionModel;
};

type CaptionResult = {
	caption: string;
	raw?: unknown;
};

const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

function resolveApiKey(model: CaptionModel) {
	if (model.apiKeyEnv && env[model.apiKeyEnv]) {
		return env[model.apiKeyEnv] as string;
	}
	if (env.AI_CAPTION_API_KEY) {
		return env.AI_CAPTION_API_KEY as string;
	}
	throw new Error(
		"缺少模型 API Key，请在环境变量中配置 AI_CAPTION_API_KEY 或模型专属 apiKeyEnv",
	);
}

function resolveBaseUrl(model: CaptionModel) {
	if (model.baseUrl) {
		return model.baseUrl.replace(/\/$/, "");
	}
	if (env.AI_CAPTION_BASE_URL) {
		return (env.AI_CAPTION_BASE_URL as string).replace(/\/$/, "");
	}
	return "https://api.openai.com/v1";
}

function resolveModelName(model: CaptionModel) {
	if (model.modelName) {
		return model.modelName;
	}
	if (env.AI_CAPTION_MODEL) {
		return env.AI_CAPTION_MODEL as string;
	}
	return "gpt-4o-mini";
}

export async function generateCaption({
	imageUrl,
	prompt,
	model,
}: CaptionOptions): Promise<CaptionResult> {
	const apiKey = resolveApiKey(model);
	const baseUrl = resolveBaseUrl(model);
	const modelName = resolveModelName(model);
	const effectivePrompt =
		prompt?.trim() ||
		(env.AI_CAPTION_PROMPT as string | undefined) ||
		"Generate a concise yet descriptive caption for this image to support downstream tagging and moderation.";

	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: modelName,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: effectivePrompt },
						{ type: "image_url", image_url: { url: imageUrl } },
					],
				},
			],
			max_tokens: 300,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`模型调用失败: ${response.status} ${errorText}`);
	}

	const json = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const caption = json.choices?.[0]?.message?.content?.trim() ?? "";

	if (!caption) {
		throw new Error("模型未返回可用的描述文本");
	}

	return {
		caption,
		raw: json,
	};
}
