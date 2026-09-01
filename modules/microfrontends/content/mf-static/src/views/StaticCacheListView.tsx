import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import {
	objectRef,
	presentReference,
	type SetRef,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { ListMetaParams } from "g-static";
import { useMemo } from "preact/compat";
import staticService from "../service";

const columns = [
	{ id: "id", title: "Page", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "status", title: "Status", type: COLUMN_TYPES.STATUS },
	{ id: "contentType", title: "Type", type: COLUMN_TYPES.TEXT },
	{ id: "size", title: "Size", type: COLUMN_TYPES.NUMBER },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

export const StaticCacheListView = ({ reference }: { reference?: SetRef }) => {
	const store = useMemo(() => {
		const domain = createDomain(`static-cache-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			staticService.listMeta(params as ListMetaParams),
		);
	}, []);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;
	return (
		<EntityListView
			tableId="static-cache-entries"
			title="SSR cache"
			store={store}
			columns={columns}
			baseFilters={filter ? { filter } : undefined}
			onRowClick={(row) => {
				const id =
					row && typeof row === "object" && "id" in row
						? (row as { id?: unknown }).id
						: undefined;
				if (typeof id === "string")
					void presentReference(objectRef("static.cache-entry", id));
			}}
		/>
	);
};
