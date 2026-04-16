import { useUnit } from "effector-react";
import { HeaderPanelLayout } from "front-core";
import { Save, Trash2 } from "lucide-react";
import {
	$selectedScript,
	deleteScriptClicked,
	saveScriptClicked,
	scriptContentChanged,
} from "../domain-scripts";

export const ScriptsEditView = () => {
	const selectedScript = useUnit($selectedScript);

	if (!selectedScript) {
		return <div>Select or create a script</div>;
	}

	const headerConfig = {
		title: selectedScript.path,
		actions: [
			{
				id: "save",
				label: "Save",
				icon: Save,
				event: saveScriptClicked,
				variant: "default" as const,
			},
			{
				id: "delete",
				label: "Delete",
				icon: Trash2,
				event: deleteScriptClicked,
				variant: "destructive" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<textarea
				className="w-full h-full p-4 font-mono text-sm border rounded resize-none"
				value={selectedScript.content}
				onChange={(event) => scriptContentChanged(event.target.value)}
				spellCheck={false}
			/>
		</HeaderPanelLayout>
	);
};
