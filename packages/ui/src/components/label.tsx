import * as React from "react";

import { cn } from "../lib/utils";

const Label = React.forwardRef<
	HTMLLabelElement,
	React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, children, ...props }, ref) => (
	// biome-ignore lint/a11y/noLabelWithoutControl: usage must pass htmlFor/children
	<label
		ref={ref}
		className={cn(
			"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
			className,
		)}
		{...props}
	>
		{children}
	</label>
));
Label.displayName = "Label";

export { Label };
