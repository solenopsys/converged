import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { CommunityView } from "./views/CommunityView";

export default defineMicrofrontend({
	id: "mf-community",
	types: [
		{
			id: "community.post",
			label: "Community post",
			pluralLabel: "Community",
			categories: ["core.communication", "core.selectable", "core.creatable"],
		},
	],
	views: [
		{
			id: "community.post.feed",
			accepts: setOf("community.post"),
			component: CommunityView,
		},
	],
	operations: [],
});
