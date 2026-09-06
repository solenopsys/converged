import { defineSurface } from "front-core/object-runtime";
import { dagContribution } from "./dag/objects";
import { shedullerContribution } from "./sheduller/objects";
import { webhooksContribution } from "./webhooks/objects";

export default defineSurface({
	id: "sf-automation",
	label: "Automation",
	purpose:
		"Workflows, schedules, webhook endpoints, and their execution history",
	types: [
		...dagContribution.types,
		...shedullerContribution.types,
		...webhooksContribution.types,
	],
	views: [
		...dagContribution.views,
		...shedullerContribution.views,
		...webhooksContribution.views,
	],
	operations: [
		...dagContribution.operations,
		...shedullerContribution.operations,
		...webhooksContribution.operations,
	],
});
