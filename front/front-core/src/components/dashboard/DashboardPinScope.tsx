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

function getFallbackScopeId(): string {
	if (typeof window === "undefined") return "dashboard";
	return normalizeScopeId(window.location.pathname || "dashboard");
}

export function DashboardPinScope({
	children,
	enabled = true,
	scopeId,
}: DashboardPinScopeProps) {
	const normalizedScopeId = normalizeScopeId(scopeId ?? getFallbackScopeId());
	const value = React.useMemo(
		() => ({
			enabled,
			scopeId: normalizedScopeId,
		}),
		[enabled, normalizedScopeId],
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
