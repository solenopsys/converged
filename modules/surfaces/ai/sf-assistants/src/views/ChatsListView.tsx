import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	Plus,
	RefreshCw,
	useSurfaceTranslation,
} from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import React, { useEffect } from "preact/compat";
import { createChatsColumns } from "../config";
import {
	$chatsStore,
	addChatClicked,
	chatsListViewMounted,
	refreshChatsClicked,
} from "../domain-chats";

export const ChatsListView = () => {
	const chatsState = useUnit($chatsStore.$state);
	const { t } = useSurfaceTranslation("assistants-sf");

	useEffect(() => {
		chatsListViewMounted();
	}, []);

	const headerConfig = {
		title: t("chatsList.title"),
		actions: [
			{
				id: "add",
				label: t("chatsList.actions.newChat"),
				icon: Plus,
				event: addChatClicked,
				variant: "default" as const,
			},
			{
				id: "refresh",
				label: t("chatsList.actions.refresh"),
				icon: RefreshCw,
				event: refreshChatsClicked,
				variant: "outline" as const,
			},
		],
	};

	const handleRowClick = (row) => {
		const recordId = row.threadId || row.id || row.chatId;
		if (!recordId) return;
		const title =
			typeof row.name === "string" && row.name.trim() ? row.name : undefined;
		void presentReference(
			objectRef("assistants.chat", recordId, title ? { title } : {}),
			{ source: "user" },
		);
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={chatsState.items}
				hasMore={chatsState.hasMore}
				loading={chatsState.loading}
				columns={createChatsColumns(t)}
				onRowClick={handleRowClick}
				onLoadMore={$chatsStore.loadMore}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
