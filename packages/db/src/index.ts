import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

const sql = neon(env.DATABASE_URL || "");
export const db = drizzle(sql);

export * from "./schema/platform";
