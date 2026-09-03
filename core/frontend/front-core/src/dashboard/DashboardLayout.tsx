import type { ReactNode } from "preact/compat";
import { DashboardPinScope } from "./DashboardPinScope";

export function DashboardLayout({
	children,
	pinScopeId,
}: {
	children?: ReactNode;
	pinScopeId?: string;
}) {
	return (
		<DashboardPinScope scopeId={pinScopeId}>
			<div className="flex flex-col gap-4">{children}</div>
		</DashboardPinScope>
	);
}
