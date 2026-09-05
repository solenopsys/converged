import { createDomain, sample } from "effector";

const domain = createDomain("dag-workflows");

export const openWorkflowForm = domain.createEvent<{ workflow: any }>(
	"OPEN_WORKFLOW_FORM",
);

// Current workflow being edited
export const $currentWorkflow = domain.createStore<any>(null);
sample({
	clock: openWorkflowForm,
	fn: ({ workflow }) => workflow || null,
	target: $currentWorkflow,
});

export default domain;
