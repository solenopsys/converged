import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { ChatView } from "./views/ChatView";

export default defineMicrofrontend({
	id: "mf-chats",
	types: [
		{
			id: "chats.chat",
			label: "Chat",
			pluralLabel: "Chats",
			categories: ["core.communication", "core.selectable"],
		},
	],
	views: [
		{
			id: "chats.chat.table",
			accepts: setOf("chats.chat"),
			component: ChatView,
		},
	],
	operations: [],
});
