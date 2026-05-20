import { Client, Receiver } from "@upstash/qstash";
import { logger } from "./logger";

const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

const token = env.QSTASH_TOKEN;
const currentSigningKey = env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = env.QSTASH_NEXT_SIGNING_KEY;

const qstash = token ? new Client({ token }) : null;
const receiver = currentSigningKey
	? new Receiver({ currentSigningKey, nextSigningKey: nextSigningKey || "" })
	: null;

export async function publishCaptionJob(captionId: number): Promise<boolean> {
	if (!qstash || !token) {
		logger.warn("QStash not configured, skipping publish", { captionId });
		return false;
	}

	const baseUrl = env.VERCEL_URL
		? `https://${env.VERCEL_URL}`
		: (env.CORS_ORIGIN || "http://localhost:3000").replace(/:\d+$/, ":3000");

	try {
		await qstash.publishJSON({
			url: `${baseUrl}/api/caption-worker`,
			body: { captionId },
			retries: 3,
		});
		logger.debug("Published caption job to QStash", { captionId });
		return true;
	} catch (error) {
		logger.error("Failed to publish caption job", {
			captionId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

export async function verifyQstashSignature(
	signature: string | null,
	body: string,
): Promise<boolean> {
	if (!receiver) {
		logger.warn("QStash receiver not configured, accepting request");
		return true;
	}

	if (!signature) {
		logger.warn("Missing QStash signature header");
		return false;
	}

	try {
		await receiver.verify({ signature, body });
		return true;
	} catch (error) {
		logger.error("QStash signature verification failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}
