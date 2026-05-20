const levels = ["debug", "info", "warn", "error"] as const;
type Level = (typeof levels)[number];

const levelOrder: Record<Level, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function getMinLevel(): Level {
	const env = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process?.env?.LOG_LEVEL;
	if (env && levels.includes(env as Level)) {
		return env as Level;
	}
	return (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process?.env?.NODE_ENV === "production"
		? "info"
		: "debug";
}

function formatLog(
	level: Level,
	message: string,
	meta?: Record<string, unknown>,
): string {
	const timestamp = new Date().toISOString();
	const base = { ts: timestamp, level, msg: message };
	return JSON.stringify(meta ? { ...base, ...meta } : base);
}

export const logger = {
	debug(msg: string, meta?: Record<string, unknown>) {
		if (levelOrder[getMinLevel()] <= levelOrder.debug) {
			console.debug(formatLog("debug", msg, meta));
		}
	},
	info(msg: string, meta?: Record<string, unknown>) {
		if (levelOrder[getMinLevel()] <= levelOrder.info) {
			console.info(formatLog("info", msg, meta));
		}
	},
	warn(msg: string, meta?: Record<string, unknown>) {
		if (levelOrder[getMinLevel()] <= levelOrder.warn) {
			console.warn(formatLog("warn", msg, meta));
		}
	},
	error(msg: string, meta?: Record<string, unknown>) {
		if (levelOrder[getMinLevel()] <= levelOrder.error) {
			console.error(formatLog("error", msg, meta));
		}
	},
};
