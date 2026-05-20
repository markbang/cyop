import { describe, expect, it } from "bun:test";
import type { Context } from "../context";
import { appRouter } from "../routers/index";

function createCaller(session: Context["session"]) {
	return appRouter.createCaller({ session } as Context);
}

const mockSession = {
	user: {
		id: "test-user-1",
		email: "test@example.com",
		name: "Test User",
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		image: null as string | null,
	},
	session: {
		id: "test-session-1",
		userId: "test-user-1",
		expiresAt: new Date(Date.now() + 86400000),
		ipAddress: null as string | null,
		userAgent: null as string | null,
		token: "test-token",
		createdAt: new Date(),
		updatedAt: new Date(),
	},
};

describe("healthCheck", () => {
	it("returns OK for unauthenticated users", async () => {
		const caller = createCaller(null);
		expect(await caller.healthCheck()).toBe("OK");
	});
});

describe("privateData", () => {
	it("returns user email when authenticated", async () => {
		const caller = createCaller(mockSession);
		const result = await caller.privateData();
		expect(result.user.email).toBe("test@example.com");
	});

	it("throws UNAUTHORIZED without session", async () => {
		const caller = createCaller(null);
		await expect(caller.privateData()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});
});
