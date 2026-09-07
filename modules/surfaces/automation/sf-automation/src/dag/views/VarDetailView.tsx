import { BasicFormView } from "front-core";
import { $currentVar, openVarForm, updateVarFx } from "../domain-vars";
import { parseVarValue, varsFormFields } from "../functions/vars";

export const VarDetailView = () => (
	<BasicFormView
		fields={varsFormFields}
		entityStore={$currentVar}
		title="Edit variable"
		subtitle="Update variable value"
		onSave={async (data: { value: any }) => {
			const current = $currentVar.getState();
			if (!current?.key) return;
			await updateVarFx({
				key: current.key,
				value: parseVarValue(data?.value),
			});
		}}
		onCancel={() => openVarForm({ variable: null })}
	/>
);

export default VarDetailView;
