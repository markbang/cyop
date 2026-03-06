import { Button } from "@cyop/ui/components/button";
import { Input } from "@cyop/ui/components/input";
import { Label } from "@cyop/ui/components/label";
import { useNavigate } from "@tanstack/react-router";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import Loader from "./loader";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();
	const [formData, setFormData] = useState({
		email: "",
		password: "",
	});
	const [formErrors, setFormErrors] = useState<{
		email?: string;
		password?: string;
	}>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const email = formData.email.trim();
	const canSubmit =
		email.length > 0 &&
		email.includes("@") &&
		formData.password.length >= 8 &&
		!isSubmitting;

	const validate = () => {
		const errors: { email?: string; password?: string } = {};
		const email = formData.email.trim();

		if (!email) {
			errors.email = "Email is required";
		} else if (!email.includes("@")) {
			errors.email = "Invalid email address";
		}

		if (!formData.password) {
			errors.password = "Password is required";
		} else if (formData.password.length < 8) {
			errors.password = "Password must be at least 8 characters";
		}

		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();

		if (!validate()) {
			return;
		}

		setIsSubmitting(true);
		try {
			await authClient.signIn.email(
				{
					email: formData.email.trim(),
					password: formData.password,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/dashboard",
						});
						toast.success("Sign in successful");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">Welcome Back</h1>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							value={formData.email}
							onChange={(event: ChangeEvent<HTMLInputElement>) =>
								setFormData((prev) => ({
									...prev,
									email: event.target.value,
								}))
							}
						/>
						{formErrors.email ? (
							<p className="text-red-500">{formErrors.email}</p>
						) : null}
					</div>
				</div>

				<div>
					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							value={formData.password}
							onChange={(event: ChangeEvent<HTMLInputElement>) =>
								setFormData((prev) => ({
									...prev,
									password: event.target.value,
								}))
							}
						/>
						{formErrors.password ? (
							<p className="text-red-500">{formErrors.password}</p>
						) : null}
					</div>
				</div>

				<Button type="submit" className="w-full" disabled={!canSubmit}>
					{isSubmitting ? "Submitting..." : "Sign In"}
				</Button>
			</form>

			<div className="mt-4 text-center">
				<Button
					variant="link"
					onClick={onSwitchToSignUp}
					className="text-indigo-600 hover:text-indigo-800"
				>
					Need an account? Sign Up
				</Button>
			</div>
		</div>
	);
}
