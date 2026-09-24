import type { ReactNode } from "preact/compat";
import { ContentContainer } from "../components/ContentContainer";
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
			<ContentContainer className="flex w-full max-w-none flex-col gap-4">
				{children}
			</ContentContainer>
		</DashboardPinScope>
	);
}
