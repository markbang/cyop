import { redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export async function requireSession() {
	const session = await authClient.getSession();

	if (!session.data) {
		redirect({
			to: "/login",
			throw: true,
		});
	}

	return { session };
}
