import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "../lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs transition-colors",
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary/10 text-primary",
				secondary: "border-transparent bg-secondary text-secondary-foreground",
				outline: "border-border text-foreground",
				success:
					"border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100",
				warning:
					"border-transparent bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100",
				destructive:
					"border-transparent bg-red-100 text-red-900 dark:bg-red-400/20 dark:text-red-100",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type BadgeVariant =
	| "default"
	| "secondary"
	| "outline"
	| "success"
	| "warning"
	| "destructive";

export interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
	variant?: BadgeVariant;
	children?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
	({ className, variant, children, ...props }, ref) => {
		return (
			<span
				ref={ref}
				className={cn(badgeVariants({ variant }), className)}
				{...props}
			>
				{children}
			</span>
		);
	},
);
Badge.displayName = "Badge";

export { Badge };
