import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import {
	objectRef,
	presentReference,
	type SetRef,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { TopicListParams } from "g-community";
import { useMemo } from "preact/compat";
import { communityClient } from "../services";

const columns = [
	{ id: "title", title: "Topic", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "createdBy", title: "Author", type: COLUMN_TYPES.TEXT },
	{ id: "lastActivityAt", title: "Last activity", type: COLUMN_TYPES.DATE },
	{ id: "isPinned", title: "Pinned", type: COLUMN_TYPES.BOOLEAN },
];

export const TopicsListView = ({ reference }: { reference?: SetRef }) => {
	const store = useMemo(() => {
		const domain = createDomain(`community-topics-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			communityClient.listTopics(params as TopicListParams),
		);
	}, []);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;
	return (
		<EntityListView
			tableId="community-topics"
			title="Forum topics"
			store={store}
			columns={columns}
			baseFilters={filter ? { filter } : undefined}
			onRowClick={(row) => {
				const id =
					row && typeof row === "object" && "id" in row
						? (row as { id?: unknown }).id
						: undefined;
				if (typeof id === "string")
					void presentReference(objectRef("community.topic", id));
			}}
		/>
	);
};
