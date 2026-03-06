import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor")({
	beforeLoad: async () => {
		const { authClient } = await import("@/lib/auth-client");
		const session = await authClient.getSession();
		if (!session.data) {
			redirect({
				to: "/login",
				throw: true,
			});
		}
		return { session };
	},
});
