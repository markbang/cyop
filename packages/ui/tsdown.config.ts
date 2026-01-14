import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/**/*.ts", "src/**/*.tsx"],
	sourcemap: true,
	dts: true,
	onSuccess: async () => {
		const { copyFileSync } = await import("node:fs");
		copyFileSync("styles.css", "dist/styles.css");
	},
});
