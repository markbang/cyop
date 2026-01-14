import type { auth } from "@cyop/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const serverUrl = import.meta.env.VITE_SERVER_URL;

export const authClient = createAuthClient({
	baseURL: serverUrl,
	plugins: [inferAdditionalFields<typeof auth>()],
});
