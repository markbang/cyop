import { createHmac, createHash } from "node:crypto";

const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";

type StorageConfig = {
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	region: string;
	endpoint: string;
	forcePathStyle: boolean;
};

type PresignedRequest = {
	url: string;
	headers: Record<string, string>;
};

let cachedConfig: StorageConfig | null = null;

function getStorageConfig(): StorageConfig {
	if (cachedConfig) {
		return cachedConfig;
	}

	const accessKeyId = process.env.S3_ACCESS_KEY_ID;
	const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
	const bucket = process.env.S3_BUCKET;
	const region = process.env.S3_REGION;
	const endpoint =
		process.env.S3_ENDPOINT || (region ? `https://s3.${region}.amazonaws.com` : undefined);

	if (!accessKeyId || !secretAccessKey || !bucket || !region || !endpoint) {
		throw new Error(
			"S3 storage is not configured. Please set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION and S3_ENDPOINT.",
		);
	}

	cachedConfig = {
		accessKeyId,
		secretAccessKey,
		bucket,
		region,
		endpoint: endpoint.replace(/\/$/, ""),
		forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
	};

	return cachedConfig;
}

function toAmzDate(date: Date) {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(date: Date) {
	return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function encodeRfc3986(value: string) {
	return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hashSha256(value: string) {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, value: string | Buffer) {
	return createHmac("sha256", key).update(value).digest();
}

function signHex(key: Buffer, value: string) {
	return createHmac("sha256", key).update(value).digest("hex");
}

function getSignatureKey(secret: string, dateStamp: string, region: string) {
	const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
	const kRegion = hmacSha256(kDate, region);
	const kService = hmacSha256(kRegion, SERVICE);
	return hmacSha256(kService, "aws4_request");
}

function encodeKey(key: string) {
	return key
		.split("/")
		.map((segment) => encodeRfc3986(segment))
		.join("/");
}

export function buildStorageKey(datasetId: number, originalName: string) {
	const normalizedName = originalName
		.toLowerCase()
		.replace(/[^a-z0-9.-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
	const timestamp = Date.now();
	return `datasets/${datasetId}/${timestamp}-${normalizedName || "asset"}`;
}

export function buildPublicUrl(key: string) {
	const customBase = process.env.ASSET_PUBLIC_URL?.replace(/\/$/, "");
	if (customBase) {
		return `${customBase}/${key}`;
	}
	const { endpoint, bucket } = getStorageConfig();
	return `${endpoint}/${bucket}/${key}`;
}

export function getStorageBucket() {
	return getStorageConfig().bucket;
}

export function createPresignedUploadUrl({
	key,
	contentType,
	expiresIn = 900,
}: {
	key: string;
	contentType: string;
	expiresIn?: number;
}): PresignedRequest {
	const config = getStorageConfig();
	const now = new Date();
	const amzDate = toAmzDate(now);
	const dateStamp = toDateStamp(now);
	const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
	const canonicalUri = `/${config.bucket}/${encodeKey(key)}`;
	const host = new URL(config.endpoint).host;

	const signedHeaders = `content-type;host`;
	const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
	const payloadHash = "UNSIGNED-PAYLOAD";

	const credential = `${config.accessKeyId}/${credentialScope}`;
	const queryParams: Array<[string, string]> = [
		["X-Amz-Algorithm", AWS_ALGORITHM],
		["X-Amz-Credential", credential],
		["X-Amz-Date", amzDate],
		["X-Amz-Expires", String(expiresIn)],
		["X-Amz-SignedHeaders", signedHeaders],
	];

	const canonicalQuerystring = queryParams
		.map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
		.sort()
		.join("&");

	const canonicalRequest = [
		"PUT",
		canonicalUri,
		canonicalQuerystring,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join("\n");

	const stringToSign = [
		AWS_ALGORITHM,
		amzDate,
		credentialScope,
		hashSha256(canonicalRequest),
	].join("\n");

	const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region);
	const signature = signHex(signingKey, stringToSign);

	const baseUrl = `${config.endpoint}/${config.bucket}/${encodeKey(key)}`;
	const presignedUrl = `${baseUrl}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;

	return {
		url: presignedUrl,
		headers: {
			"Content-Type": contentType,
		},
	};
}
