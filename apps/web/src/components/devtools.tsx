import { lazy, Suspense } from "react";

const TanStackRouterDevtools = lazy(() =>
	import("@tanstack/react-router-devtools").then((module) => ({
		default: module.TanStackRouterDevtools,
	})),
);

const ReactQueryDevtools = lazy(() =>
	import("@tanstack/react-query-devtools").then((module) => ({
		default: module.ReactQueryDevtools,
	})),
);

export default function Devtools() {
	if (!import.meta.env.DEV) {
		return null;
	}

	return (
		<Suspense fallback={null}>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</Suspense>
	);
}
