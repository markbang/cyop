import { createFileRoute } from "@tanstack/react-router";
import { requireSession } from "@/lib/require-session";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: requireSession,
});
