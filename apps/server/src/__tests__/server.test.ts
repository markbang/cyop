import { describe, expect, it, mock } from "bun:test";

process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ||= "test-secret";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
process.env.CORS_ORIGIN ||= "http://localhost:3001";

mock.module("@cyop/api/context", () => ({
	createContext() {
		return Promise.resolve({ session: null });
	},
}));

mock.module("@cyop/api/routers/index", () => ({
	appRouter: {
		createCaller() {
			return {};
		},
	},
}));

mock.module("@cyop/auth", () => ({
	auth: {
		handler() {
			return new Response("OK");
		},
		api: {
			getSession() {
				return null;
			},
		},
	},
}));

mock.module("@cyop/api/services/logger", () => ({
	logger: {
		debug() {},
		info() {},
		warn() {},
		error() {},
	},
}));

const { default: app } = await import("../index");

describe("server health check", () => {
	it("returns OK on GET /", async () => {
		const res = await app.request("/");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});
});
