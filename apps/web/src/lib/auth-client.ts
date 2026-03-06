import { createAuthClient } from "better-auth/react";

const serverUrl = import.meta.env.VITE_SERVER_URL;

export const authClient = createAuthClient({
	baseURL: serverUrl,
});
