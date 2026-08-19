import type { ReactNode } from "preact/compat";
import { DashboardPinScope } from "./DashboardPinScope";

export function DashboardLayout({
	children,
	pinScopeId,
}: {
	children?: ReactNode;
	pinScopeId?: string;
}) {
	return <DashboardPinScope scopeId={pinScopeId}>{children}</DashboardPinScope>;
}
