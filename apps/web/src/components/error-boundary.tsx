import { Button } from "@cyop/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@cyop/ui/components/card";
import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	render() {
		if (this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="flex h-full items-center justify-center p-8">
					<Card className="max-w-md">
						<CardHeader>
							<AlertTriangle className="mb-2 h-8 w-8 text-destructive" />
							<CardTitle>Something went wrong</CardTitle>
							<CardDescription>
								{import.meta.env.DEV
									? this.state.error.message || "An unexpected error occurred"
									: "An unexpected error occurred"}
							</CardDescription>
						</CardHeader>
						<CardContent className="text-muted-foreground text-sm">
							{import.meta.env.DEV &&
								this.state.error.message !== "An unexpected error occurred" && (
									<pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
										{this.state.error.stack?.split("\n").slice(0, 4).join("\n")}
									</pre>
								)}
						</CardContent>
						<CardFooter>
							<Button
								onClick={() => {
									this.setState({ error: null });
									window.location.reload();
								}}
							>
								Reload page
							</Button>
						</CardFooter>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}
