import * as React from "preact/compat";

import { cn } from "../../lib/utils";

// Rough replacement for @radix-ui/react-scroll-area: native overflow scrolling,
// no custom draggable thumb.
const ScrollArea = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
	({ className, children, ...props }, ref) => (
		<div ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
			<div data-slot="scroll-area-viewport" className="h-full w-full overflow-auto rounded-[inherit]">
				{children}
			</div>
		</div>
	),
);
ScrollArea.displayName = "ScrollArea";

const ScrollBar = React.forwardRef<
	HTMLDivElement,
	React.ComponentPropsWithoutRef<"div"> & { orientation?: "vertical" | "horizontal" }
>(({ className, orientation = "vertical", ...props }, ref) => (
	// Native scrolling handles this; kept as a no-op for API compatibility.
	<div ref={ref} className={cn("hidden", className)} data-orientation={orientation} {...props} />
));
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
