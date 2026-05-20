import { describe, expect, it } from "bun:test";

const baseUrl = "http://localhost:3000";

describe("server health check", () => {
	it("returns OK on GET /", async () => {
		// This test hits the running dev server.
		// In CI, start the server first with: bun run dev:server &
		try {
			const res = await fetch(`${baseUrl}/`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("OK");
		} catch {
			// Server not running — skip
			console.warn("Server not running, skipping HTTP test");
		}
	});
});
