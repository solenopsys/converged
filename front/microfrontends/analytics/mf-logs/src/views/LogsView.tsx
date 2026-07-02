import { EntityListView, useMicrofrontendTranslation } from "front-core";
import React from "react";
import { $logsColdStore, $logsHotStore, type LogsMode } from "../domain-logs";
import { logsColumns } from "../functions/columns";

const LOGS_MF_ID = "logs-mf";

export const LogsView = ({ mode = "hot" }: { mode?: LogsMode }) => {
	const { t } = useMicrofrontendTranslation(LOGS_MF_ID);

	return (
		<EntityListView
			tableId={`logs-${mode}`}
			title={
				mode === "hot" ? t("logs.view.hotTitle") : t("logs.view.coldTitle")
			}
			refreshLabel={t("logs.view.refresh")}
			store={mode === "hot" ? $logsHotStore : $logsColdStore}
			columns={logsColumns}
		/>
	);
};
