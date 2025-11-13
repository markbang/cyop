import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary/10 text-primary",
				secondary: "border-transparent bg-secondary text-secondary-foreground",
				outline: "text-foreground border-border",
				success: "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100",
				warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100",
				destructive:
					"border-transparent bg-red-100 text-red-900 dark:bg-red-400/20 dark:text-red-100",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<span className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}
