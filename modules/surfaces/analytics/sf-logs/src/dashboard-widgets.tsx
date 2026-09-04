import { useUnit } from "effector-preact";
import {
	AlertCircle,
	AlertTriangle,
	Database,
	registerDashboardWidgets,
	StatisticCard,
	useSurfaceTranslation,
} from "front-core";
import type { ComponentType } from "preact/compat";
import { useEffect } from "preact/compat";
import { $logsStats, logsStatsViewMounted } from "./domain-stats";

// Live dashboard widgets for sf-logs. Keys must match the `dashboardPin.id`s
// used in LogsStatsView so persisted pins re-materialize as live widgets.

const LOGS_SF_ID = "logs-sf";

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
	const { t } = useSurfaceTranslation(LOGS_SF_ID);
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
