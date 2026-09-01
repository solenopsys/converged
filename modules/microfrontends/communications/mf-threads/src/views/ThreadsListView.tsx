import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import {
	objectRef,
	presentReference,
	type SetRef,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { ThreadListParams } from "g-threads";
import { useMemo } from "preact/compat";
import { threadsClient } from "../services";

const columns = [
	{ id: "threadId", title: "Thread", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "kind", title: "Kind", type: COLUMN_TYPES.TEXT },
	{ id: "messageCount", title: "Messages", type: COLUMN_TYPES.NUMBER },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

export const ThreadsListView = ({ reference }: { reference?: SetRef }) => {
	const store = useMemo(() => {
		const domain = createDomain(`threads-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			threadsClient.listThreads(params as ThreadListParams),
		);
	}, []);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;

	return (
		<EntityListView
			tableId="threads"
			title="Threads"
			store={store}
			columns={columns}
			baseFilters={filter ? { filter } : undefined}
			onRowClick={(row) => {
				const id =
					row && typeof row === "object" && "threadId" in row
						? (row as { threadId?: unknown }).threadId
						: undefined;
				if (typeof id === "string")
					void presentReference(objectRef("threads.thread", id));
			}}
		/>
	);
};
