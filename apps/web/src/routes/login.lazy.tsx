import { createLazyFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import Loader from "@/components/loader";

const SignInForm = lazy(() => import("@/components/sign-in-form"));
const SignUpForm = lazy(() => import("@/components/sign-up-form"));

export const Route = createLazyFileRoute("/login")({
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(false);

	return (
		<Suspense fallback={<Loader />}>
			{showSignIn ? (
				<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
			) : (
				<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
			)}
		</Suspense>
	);
}
