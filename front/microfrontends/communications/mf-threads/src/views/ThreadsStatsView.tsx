import { useUnit } from "effector-react";
import {
	HeaderPanelLayout,
	ScrollArea,
	StatisticCard,
	useMicrofrontendTranslation,
} from "front-core";
import {
	Hash,
	MessageCircle,
	MessageSquare,
	MessagesSquare,
	Phone,
	RefreshCw,
	Users,
} from "lucide-react";
import { useEffect } from "react";
import {
	$threadsStats,
	refreshThreadsStatsClicked,
	threadsStatsViewMounted,
} from "../domain-stats";

const THREADS_MF_ID = "threads-mf";

export const ThreadsStatsView = ({ bus: _bus }: { bus?: unknown }) => {
	const stats = useUnit($threadsStats);
	const { t } = useMicrofrontendTranslation(THREADS_MF_ID);

	useEffect(() => {
		threadsStatsViewMounted();
	}, []);

	const headerConfig = {
		title: t("stats.title"),
		actions: [
			{
				id: "refresh",
				label: t("stats.refresh"),
				icon: RefreshCw,
				event: refreshThreadsStatsClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<ScrollArea className="h-full">
				<div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
					<StatisticCard
						title={t("stats.total")}
						value={stats.total}
						icon={Hash}
						description={t("stats.totalDescription")}
						dashboardPin={{ id: "threads.total", title: t("stats.total") }}
					/>
					<StatisticCard
						title={t("stats.messages")}
						value={stats.totalMessages}
						icon={MessagesSquare}
						description={t("stats.messagesDescription")}
						dashboardPin={{ id: "threads.messages", title: t("stats.messages") }}
					/>
					<StatisticCard
						title={t("stats.chat")}
						value={stats.byKind?.chat ?? 0}
						icon={MessageSquare}
						description={t("stats.chatDescription")}
						dashboardPin={{ id: "threads.chat", title: t("stats.chat") }}
					/>
					<StatisticCard
						title={t("stats.audio")}
						value={stats.byKind?.audio ?? 0}
						icon={Phone}
						description={t("stats.audioDescription")}
						dashboardPin={{ id: "threads.audio", title: t("stats.audio") }}
					/>
					<StatisticCard
						title={t("stats.forum")}
						value={stats.byKind?.forum ?? 0}
						icon={Users}
						description={t("stats.forumDescription")}
						dashboardPin={{ id: "threads.forum", title: t("stats.forum") }}
					/>
					<StatisticCard
						title={t("stats.comment")}
						value={stats.byKind?.comment ?? 0}
						icon={MessageCircle}
						description={t("stats.commentDescription")}
						dashboardPin={{ id: "threads.comment", title: t("stats.comment") }}
					/>
				</div>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};
