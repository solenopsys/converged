import { useUnit } from "effector-react";
import {
	registerDashboardWidgets,
	StatisticCard,
	useMicrofrontendTranslation,
} from "front-core";
import {
	Hash,
	MessageCircle,
	MessageSquare,
	MessagesSquare,
	Phone,
	Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect } from "react";
import { $threadsStats, threadsStatsViewMounted } from "./domain-stats";

// Live dashboard widgets for mf-threads. Keys must match the dashboardPin ids
// used in ThreadsStatsView so persisted pins re-materialize as live widgets.

const THREADS_MF_ID = "threads-mf";

type ThreadsStatField =
	| "total"
	| "messages"
	| "chat"
	| "audio"
	| "forum"
	| "comment";

const META: Record<
	ThreadsStatField,
	{ titleKey: string; icon: ComponentType<{ className?: string }> }
> = {
	total: { titleKey: "stats.total", icon: Hash },
	messages: { titleKey: "stats.messages", icon: MessagesSquare },
	chat: { titleKey: "stats.chat", icon: MessageSquare },
	audio: { titleKey: "stats.audio", icon: Phone },
	forum: { titleKey: "stats.forum", icon: Users },
	comment: { titleKey: "stats.comment", icon: MessageCircle },
};

function valueFor(
	stats: ReturnType<typeof useUnit<typeof $threadsStats>>,
	field: ThreadsStatField,
): number {
	if (field === "total") return Number(stats.total ?? 0);
	if (field === "messages") return Number(stats.totalMessages ?? 0);
	return Number(stats.byKind?.[field] ?? 0);
}

function ThreadsStatIndicator({ field }: { field: ThreadsStatField }) {
	const stats = useUnit($threadsStats);
	const { t } = useMicrofrontendTranslation(THREADS_MF_ID);
	const meta = META[field];

	useEffect(() => {
		threadsStatsViewMounted();
	}, []);

	return (
		<StatisticCard
			title={t(meta.titleKey)}
			value={valueFor(stats, field)}
			icon={meta.icon}
			dashboardPin={{ enabled: false }}
		/>
	);
}

registerDashboardWidgets({
	"threads.total": () => <ThreadsStatIndicator field="total" />,
	"threads.messages": () => <ThreadsStatIndicator field="messages" />,
	"threads.chat": () => <ThreadsStatIndicator field="chat" />,
	"threads.audio": () => <ThreadsStatIndicator field="audio" />,
	"threads.forum": () => <ThreadsStatIndicator field="forum" />,
	"threads.comment": () => <ThreadsStatIndicator field="comment" />,
});
