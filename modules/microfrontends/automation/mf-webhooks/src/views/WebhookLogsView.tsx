import { EntityListView } from "front-core";
import React, { useMemo } from "preact/compat";
import { $logsStore } from "../domain-logs";
import { logColumns } from "../functions/columns";

export const WebhookLogsView = ({ endpointId }: { endpointId?: string }) => {
	const baseFilters = useMemo(() => ({ endpointId }), [endpointId]);

	return (
		<EntityListView
			tableId="webhook-logs"
			title="Webhook Logs"
			store={$logsStore}
			columns={logColumns}
			baseFilters={baseFilters}
			filters={[
				{
					id: "provider",
					type: "search",
					label: "Provider",
					placeholder: "Filter by provider…",
				},
			]}
		/>
	);
};

export default WebhookLogsView;
