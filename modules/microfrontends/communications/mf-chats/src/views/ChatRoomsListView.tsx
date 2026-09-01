import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import {
	objectRef,
	presentReference,
	type SetRef,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { ChatRoomsListParams } from "g-chats";
import { useMemo } from "preact/compat";
import { chatsClient } from "../services";

const columns = [
	{ id: "title", title: "Room", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "type", title: "Type", type: COLUMN_TYPES.TEXT },
	{ id: "membersCount", title: "Members", type: COLUMN_TYPES.NUMBER },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

export const ChatRoomsListView = ({ reference }: { reference?: SetRef }) => {
	const store = useMemo(() => {
		const domain = createDomain(`chat-rooms-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			chatsClient.listRooms(params as ChatRoomsListParams),
		);
	}, []);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;

	return (
		<EntityListView
			tableId="chat-rooms"
			title="Chats"
			store={store}
			columns={columns}
			baseFilters={filter ? { filter } : undefined}
			onRowClick={(row) => {
				const id =
					row && typeof row === "object" && "id" in row
						? (row as { id?: unknown }).id
						: undefined;
				if (typeof id === "string")
					void presentReference(objectRef("chats.chat", id));
			}}
		/>
	);
};
