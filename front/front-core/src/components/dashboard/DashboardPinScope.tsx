import * as React from "react";

type DashboardPinScopeValue = {
	enabled: boolean;
	scopeId: string;
};

const DashboardPinContext = React.createContext<DashboardPinScopeValue>({
	enabled: false,
	scopeId: "dashboard",
});

export type DashboardPinScopeProps = {
	children: React.ReactNode;
	enabled?: boolean;
	scopeId?: string;
};

function normalizeScopeId(value: string): string {
	const normalized = value
		.trim()
		.replace(/[^a-zA-Z0-9_.:-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "dashboard";
}

export function DashboardPinScope({
	children,
	enabled = true,
	scopeId,
}: DashboardPinScopeProps) {
	const reactId = React.useId().replace(/:/g, "");
	const value = React.useMemo(
		() => ({
			enabled,
			scopeId: normalizeScopeId(scopeId ?? `dashboard-${reactId}`),
		}),
		[enabled, reactId, scopeId],
	);

	return (
		<DashboardPinContext.Provider value={value}>
			{children}
		</DashboardPinContext.Provider>
	);
}

export function useDashboardPinScope(): DashboardPinScopeValue {
	return React.useContext(DashboardPinContext);
}
