import { useUnit } from "effector-react";
import { HeaderPanelLayout, StatisticCard } from "front-core";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import {
	$classifierDashboard,
	$classifierDashboardLoading,
	classifierDashboardViewMounted,
	refreshClassifierDashboardClicked,
} from "../domain-classifier";

export const ClassifierDashboardView = () => {
	const stats = useUnit($classifierDashboard);
	const loading = useUnit($classifierDashboardLoading);

	useEffect(() => {
		classifierDashboardViewMounted();
	}, []);

	const headerConfig = {
		title: "Classifier",
		subtitle: loading ? "Loading..." : "Dashboard",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshClassifierDashboardClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<div className="grid gap-4 md:grid-cols-2">
				<StatisticCard
					dashboardPin={{ id: "classifier.nodes", title: "Classifier nodes" }}
					title="Nodes"
					value={stats.nodes}
				/>
				<StatisticCard
					dashboardPin={{
						id: "classifier.mappings",
						title: "Classifier mappings",
					}}
					title="Mappings"
					value={stats.mappings}
				/>
			</div>
		</HeaderPanelLayout>
	);
};
