import type { JSX } from "react";

import { cn } from "../lib/utils";

type ProgressProps = {
	value?: number;
	className?: string;
};

export function Progress({ value = 0, className }: ProgressProps): JSX.Element {
	return (
		<div className={cn("h-2 w-full rounded-full bg-muted", className)}>
			<div
				className="h-full rounded-full bg-primary transition-[width]"
				style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
			/>
		</div>
	);
}
