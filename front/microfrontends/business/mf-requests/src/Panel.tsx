import type { RequestModel } from "g-requests";
import { RequestDetailView } from "./views/RequestDetailView";
import { RequestsListView } from "./views/RequestsListView";

type RequestBus = {
	run?: (actionId: string, params?: unknown) => unknown;
};

function Panel({
	bus,
	requestId,
	model,
}: {
	bus?: RequestBus;
	requestId?: string;
	model?: RequestModel | null;
}) {
	if (requestId || model?.id) {
		return <RequestDetailView requestId={requestId} model={model} />;
	}
	return <RequestsListView bus={bus} />;
}

export default Panel;
