import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout } from "front-core";
import { RefreshCw } from "lucide-react";
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
				<div className="rounded-md border p-4">
					<div className="text-sm text-muted-foreground">Nodes</div>
					<div className="text-3xl font-semibold">{stats.nodes}</div>
				</div>
				<div className="rounded-md border p-4">
					<div className="text-sm text-muted-foreground">Mappings</div>
					<div className="text-3xl font-semibold">{stats.mappings}</div>
				</div>
			</div>
		</HeaderPanelLayout>
	);
};
