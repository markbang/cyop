import "dotenv/config";
import { createContext } from "@cyop/api/context";
import { appRouter } from "@cyop/api/routers/index";
import { logger } from "@cyop/api/services/logger";
import { auth } from "@cyop/auth";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

const app = new Hono();

app.use("*", async (c, next) => {
	const start = Date.now();
	await next();
	logger.debug("request", {
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		ms: Date.now() - start,
	});
});

app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.onError((err, c) => {
	logger.error("unhandled error", {
		error: err.message,
		path: c.req.path,
		method: c.req.method,
	});
	return c.json({ error: "Internal server error" }, 500);
});

app.get("/", (c) => {
	return c.text("OK");
});

logger.info("server initialized");

export default app;
