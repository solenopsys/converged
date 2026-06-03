import type * as React from "react";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { DashboardPinScope } from "./DashboardPinScope";

interface DashboardLayoutProps {
	children: React.ReactNode;
	className?: string;
	pinnable?: boolean;
	pinScopeId?: string;
}

export function DashboardLayout({
	children,
	className,
	pinnable = true,
	pinScopeId,
}: DashboardLayoutProps) {
	return (
		<DashboardPinScope enabled={pinnable} scopeId={pinScopeId}>
			<ScrollArea className="h-full">
				<div className={cn("space-y-4", className)}>{children}</div>
			</ScrollArea>
		</DashboardPinScope>
	);
}
