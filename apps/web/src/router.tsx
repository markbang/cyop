import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";
import { queryClient, trpc } from "./utils/trpc";

export interface RouterAppContext {
	trpc: typeof trpc;
	queryClient: QueryClient;
}

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		defaultPreload: "intent",
		defaultPendingComponent: () => <Loader />,
		scrollRestoration: true,
		context: { trpc, queryClient },
		Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
			return (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			);
		},
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
