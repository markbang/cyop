import type { JSX } from "react";

import { cn } from "../lib/utils";

type ProgressProps = {
	value?: number;
	className?: string;
	indicatorClassName?: string;
};

export function Progress({
	value = 0,
	className,
	indicatorClassName,
}: ProgressProps): JSX.Element {
	return (
		<div className={cn("h-2 w-full rounded-full bg-muted", className)}>
			<div
				className={cn(
					"h-full rounded-full bg-primary transition-[width]",
					indicatorClassName,
				)}
				style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
			/>
		</div>
	);
}
