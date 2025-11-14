import { createHash, createHmac } from "node:crypto";

const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

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

function normalizeEndpoint(endpoint: string) {
	const trimmed = endpoint.trim();
	const withScheme = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	return withScheme.replace(/\/$/, "");
}

function getStorageConfig(): StorageConfig {
	if (cachedConfig) {
		return cachedConfig;
	}

	const accessKeyId = env.S3_ACCESS_KEY_ID;
	const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
	const bucket = env.S3_BUCKET;
	const region = env.S3_REGION;
	const endpointValue =
		env.S3_ENDPOINT ||
		(region ? `https://s3.${region}.amazonaws.com` : undefined);

	if (
		!accessKeyId ||
		!secretAccessKey ||
		!bucket ||
		!region ||
		!endpointValue
	) {
		throw new Error(
			"S3 storage is not configured. Please set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION and S3_ENDPOINT.",
		);
	}

	cachedConfig = {
		accessKeyId,
		secretAccessKey,
		bucket,
		region,
		endpoint: normalizeEndpoint(endpointValue),
		forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
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
	return encodeURIComponent(value).replace(
		/[!'()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
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

function joinUriSegments(...segments: Array<string | undefined>) {
	const parts = segments
		.filter((segment): segment is string =>
			Boolean(segment && segment.trim().length > 0),
		)
		.map((segment) => segment.replace(/^\/+|\/+$/g, ""));
	if (parts.length === 0) {
		return "/";
	}
	return `/${parts.join("/")}`;
}

function resolveObjectLocation(config: StorageConfig, key: string) {
	const endpointUrl = new URL(config.endpoint);
	const pathPrefix = endpointUrl.pathname === "/" ? "" : endpointUrl.pathname;
	const encodedKey = encodeKey(key);

	if (config.forcePathStyle) {
		const canonicalUri = joinUriSegments(pathPrefix, config.bucket, encodedKey);
		return {
			host: endpointUrl.host,
			canonicalUri,
			baseUrl: `${endpointUrl.origin}${canonicalUri}`,
		};
	}

	const canonicalUri = joinUriSegments(pathPrefix, encodedKey);
	const virtualHost = `${config.bucket}.${endpointUrl.host}`;

	return {
		host: virtualHost,
		canonicalUri,
		baseUrl: `${endpointUrl.protocol}//${virtualHost}${canonicalUri}`,
	};
}

export function buildPublicUrl(key: string) {
	const customBase = env.ASSET_PUBLIC_URL?.trim().replace(/\/$/, "");
	if (customBase) {
		return `${customBase}/${encodeKey(key)}`;
	}
	const config = getStorageConfig();
	const { baseUrl } = resolveObjectLocation(config, key);
	return baseUrl;
}

export function getStorageBucket() {
	return getStorageConfig().bucket;
}

type PresignParams = {
	key: string;
	method?: "PUT" | "GET" | "DELETE";
	contentType?: string;
	expiresIn?: number;
};

function createPresignedRequest({
	key,
	method = "PUT",
	contentType,
	expiresIn = 900,
}: PresignParams): PresignedRequest {
	const config = getStorageConfig();
	const location = resolveObjectLocation(config, key);
	const now = new Date();
	const amzDate = toAmzDate(now);
	const dateStamp = toDateStamp(now);
	const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
	const canonicalUri = location.canonicalUri;
	const host = location.host;

	let signedHeaders = "host";
	let canonicalHeaders = `host:${host}\n`;
	if (contentType) {
		canonicalHeaders = `content-type:${contentType}\n${canonicalHeaders}`;
		signedHeaders = `content-type;${signedHeaders}`;
	}
	const payloadHash = method === "PUT" ? "UNSIGNED-PAYLOAD" : hashSha256("");

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
		method,
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

	const signingKey = getSignatureKey(
		config.secretAccessKey,
		dateStamp,
		config.region,
	);
	const signature = signHex(signingKey, stringToSign);

	const presignedUrl = `${location.baseUrl}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;

	return {
		url: presignedUrl,
		headers: contentType ? { "Content-Type": contentType } : {},
	};
}

export function createPresignedUploadUrl(params: {
	key: string;
	contentType: string;
	expiresIn?: number;
}) {
	return createPresignedRequest({ ...params, method: "PUT" });
}

export async function deleteStorageObject(key: string) {
	try {
		const request = createPresignedRequest({
			key,
			method: "DELETE",
			expiresIn: 60,
		});
		const response = await fetch(request.url, {
			method: "DELETE",
			headers: request.headers,
		});
		if (!response.ok) {
			console.error("S3 delete error", await response.text());
		}
	} catch (error) {
		console.error("Failed to delete storage object", error);
	}
}
