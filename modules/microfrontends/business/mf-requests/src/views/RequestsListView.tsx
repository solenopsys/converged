import { createDomain } from "effector";
import {
	createInfiniteTableStore,
	EntityListView,
	useMicrofrontendTranslation,
} from "front-core";
import {
	objectRef,
	presentReference,
	type SetRef,
} from "front-core/object-runtime";
import type { RequestListParams } from "g-requests";
import { useMemo } from "preact/compat";
import { createRequestsColumns } from "../config";
import { requestsClient } from "../services";

export const RequestsListView = ({ reference }: { reference?: SetRef }) => {
	const { t } = useMicrofrontendTranslation("mf-requests");
	const columns = useMemo(() => createRequestsColumns(t), [t]);
	const store = useMemo(() => {
		const domain = createDomain(`requests-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			requestsClient.listRequests(params as RequestListParams),
		);
	}, []);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;

	const handleRowClick = (row: unknown) => {
		const id =
			row && typeof row === "object" && "id" in row
				? (row as { id?: unknown }).id
				: undefined;
		if (typeof id !== "string" || id.length === 0) return;
		void presentReference(objectRef("requests.request", id));
	};

	return (
		<EntityListView
			tableId="requests"
			title={t("list.title")}
			store={store}
			columns={columns}
			baseFilters={filter ? { filter } : undefined}
			onRowClick={handleRowClick}
		/>
	);
};
