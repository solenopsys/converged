import { defineSurface, objectOf, setOf } from "front-core/object-runtime";
import { communityClient } from "./services";
import { TopicsListView } from "./views/TopicsListView";
import { TopicView } from "./views/TopicView";

export default defineSurface({
	id: "sf-community",
	label: "Community",
	purpose: "Public forum topics and discussions",
	types: [
		{
			id: "community.topic",
			label: "Forum topic",
			pluralLabel: "Forum topics",
			categories: ["core.communication", "core.selectable", "core.creatable"],
			selection: {
				filters: [],
				describe: () => communityClient.describeSelection("community.topic"),
				load: (params) => communityClient.listTopics(params),
				inspect: (filter) => communityClient.inspectTopics(filter),
			},
		},
	],
	views: [
		{
			id: "community.topic.detail",
			accepts: objectOf("community.topic"),
			component: TopicView,
			props: (ref) => ({ topicId: ref.kind === "object" ? ref.id : undefined }),
		},
		{
			id: "community.topic.table",
			accepts: setOf("community.topic"),
			component: TopicsListView,
		},
	],
	operations: [],
});
