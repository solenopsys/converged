import {
	defineSurface,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { chatsClient } from "./services";
import { ChatRoomsListView } from "./views/ChatRoomsListView";
import { ChatRoomView } from "./views/ChatRoomView";

export default defineSurface({
	id: "sf-chats",
	types: [
		{
			id: "chats.chat",
			label: "Chat",
			pluralLabel: "Chats",
			categories: ["core.communication", "core.selectable"],
			selection: {
				filters: [],
				describe: () => chatsClient.describeSelection("chats.chat"),
				load: (params) => chatsClient.listRooms(params),
				inspect: (filter) => chatsClient.inspectChats(filter),
			},
		},
	],
	views: [
		{
			id: "chats.chat.detail",
			accepts: objectOf("chats.chat"),
			component: ChatRoomView,
			props: (ref) => ({ roomId: ref.kind === "object" ? ref.id : undefined }),
		},
		{
			id: "chats.chat.table",
			accepts: setOf("chats.chat"),
			component: ChatRoomsListView,
		},
	],
	operations: [],
});
