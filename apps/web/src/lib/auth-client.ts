import type { auth } from "@cyop/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const serverUrl =
	import.meta.env.VITE_SERVER_URL || "https://api.cyop.bangwu.top";

export const authClient = createAuthClient({
	baseURL: serverUrl,
	plugins: [inferAdditionalFields<typeof auth>()],
});
