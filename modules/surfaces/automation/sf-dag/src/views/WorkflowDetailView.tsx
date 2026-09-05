import { BasicFormView, getAllFormFields } from "front-core";
import { $currentWorkflow, openWorkflowForm } from "../domain-workflows";
import { workflowsFields } from "../functions/fields";

const workflowFormFields = getAllFormFields(workflowsFields);

export const WorkflowDetailView = () => (
	<BasicFormView
		fields={workflowFormFields}
		entityStore={$currentWorkflow}
		title="Workflow Configuration"
		subtitle="Configure workflow parameters"
		onSave={async (data: any) => {
			console.log("Save workflow:", data);
		}}
		onCancel={() => openWorkflowForm({ workflow: null })}
	/>
);
