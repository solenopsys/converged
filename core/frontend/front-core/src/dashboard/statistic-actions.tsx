import { type ComponentChildren, createContext } from "preact";
import { useContext } from "preact/hooks";

const StatisticActionsContext = createContext<Readonly<Record<string, string>>>(
	{},
);

export function StatisticActionsProvider({
	actions,
	children,
}: {
	actions?: Readonly<Record<string, string>>;
	children: ComponentChildren;
}) {
	return (
		<StatisticActionsContext.Provider value={actions ?? {}}>
			{children}
		</StatisticActionsContext.Provider>
	);
}

export function useStatisticAction(label: string): string | undefined {
	return useContext(StatisticActionsContext)[label];
}
