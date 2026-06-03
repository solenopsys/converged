import { useUnit } from "effector-react";
import {
	registerDashboardWidgets,
	StatisticCard,
	useMicrofrontendTranslation,
} from "front-core";
import { AlertCircle, AlertTriangle, Database } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect } from "react";
import { $logsStats, logsStatsViewMounted } from "./domain-stats";

// Live dashboard widgets for mf-logs. Keys must match the `dashboardPin.id`s
// used in LogsStatsView so persisted pins re-materialize as live widgets.

const LOGS_MF_ID = "logs-mf";

type LogsField = "totalHot" | "totalCold" | "errors" | "warnings";

const LOGS_META: Record<
	LogsField,
	{
		titleKey: string;
		descriptionKey: string;
		icon: ComponentType<{ className?: string }>;
	}
> = {
	totalHot: {
		titleKey: "logs.stats.totalHot",
		descriptionKey: "logs.stats.totalHotDescription",
		icon: Database,
	},
	totalCold: {
		titleKey: "logs.stats.totalCold",
		descriptionKey: "logs.stats.totalColdDescription",
		icon: Database,
	},
	errors: {
		titleKey: "logs.stats.errors",
		descriptionKey: "logs.stats.errorsDescription",
		icon: AlertCircle,
	},
	warnings: {
		titleKey: "logs.stats.warnings",
		descriptionKey: "logs.stats.warningsDescription",
		icon: AlertTriangle,
	},
};

function useLogsStatsLive() {
	const stats = useUnit($logsStats);
	useEffect(() => {
		logsStatsViewMounted();
	}, []);
	return stats;
}

function LogsStatIndicator({ field }: { field: LogsField }) {
	const stats = useLogsStatsLive();
	const { t } = useMicrofrontendTranslation(LOGS_MF_ID);
	const meta = LOGS_META[field];

	return (
		<StatisticCard
			title={t(meta.titleKey)}
			value={Number(stats[field] ?? 0)}
			icon={meta.icon}
			description={t(meta.descriptionKey)}
			dashboardPin={{ enabled: false }}
		/>
	);
}

registerDashboardWidgets({
	"logs.hot-storage": () => <LogsStatIndicator field="totalHot" />,
	"logs.cold-storage": () => <LogsStatIndicator field="totalCold" />,
	"logs.errors": () => <LogsStatIndicator field="errors" />,
	"logs.warnings": () => <LogsStatIndicator field="warnings" />,
});
