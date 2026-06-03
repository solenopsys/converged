import { useUnit } from "effector-react";
import {
	HeaderPanelLayout,
	ScrollArea,
	StatisticCard,
	useMicrofrontendTranslation,
} from "front-core";
import { AlertCircle, AlertTriangle, Database, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import {
	$logsStats,
	logsStatsViewMounted,
	refreshLogsStatsClicked,
} from "../domain-stats";

const LOGS_MF_ID = "logs-mf";

export const LogsStatsView = ({ bus: _bus }: { bus?: unknown }) => {
	const stats = useUnit($logsStats);
	const { t } = useMicrofrontendTranslation(LOGS_MF_ID);

	useEffect(() => {
		logsStatsViewMounted();
	}, []);

	const headerConfig = {
		title: t("logs.stats.title"),
		actions: [
			{
				id: "refresh",
				label: t("logs.stats.refresh"),
				icon: RefreshCw,
				event: refreshLogsStatsClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<ScrollArea className="h-full">
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					<StatisticCard
						title={t("logs.stats.totalHot")}
						value={stats.totalHot}
						icon={Database}
						description={t("logs.stats.totalHotDescription")}
						dashboardPin={{
							id: "logs.hot-storage",
							title: t("logs.stats.totalHot"),
						}}
					/>
					<StatisticCard
						title={t("logs.stats.totalCold")}
						value={stats.totalCold}
						icon={Database}
						description={t("logs.stats.totalColdDescription")}
						dashboardPin={{
							id: "logs.cold-storage",
							title: t("logs.stats.totalCold"),
						}}
					/>
					<StatisticCard
						title={t("logs.stats.errors")}
						value={stats.errors}
						icon={AlertCircle}
						description={t("logs.stats.errorsDescription")}
						dashboardPin={{ id: "logs.errors", title: t("logs.stats.errors") }}
					/>
					<StatisticCard
						title={t("logs.stats.warnings")}
						value={stats.warnings}
						icon={AlertTriangle}
						description={t("logs.stats.warningsDescription")}
						dashboardPin={{
							id: "logs.warnings",
							title: t("logs.stats.warnings"),
						}}
					/>
				</div>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};
