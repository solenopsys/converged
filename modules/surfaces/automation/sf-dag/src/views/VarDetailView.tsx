import { BasicFormView } from "front-core";
import { $currentVar, openVarForm } from "../domain-vars";
import { varsFormFields } from "../functions/vars";

export const VarDetailView = () => (
	<BasicFormView
		fields={varsFormFields}
		entityStore={$currentVar}
		title="Edit variable"
		subtitle="Update variable value"
		onCancel={() => openVarForm({ variable: null })}
	/>
);
