import { useUnit } from "effector-preact";
import {
	$selectedScript,
	deleteScriptClicked,
	saveScriptClicked,
	scriptContentChanged,
} from "../domain-scripts";

export const ScriptDetailView = () => {
	const script = useUnit($selectedScript);

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 p-4">
			<div className="flex items-center justify-between gap-3">
				<strong className="truncate">{script?.path ?? "Loading script"}</strong>
				{script && (
					<div className="flex gap-2">
						<button type="button" onClick={() => saveScriptClicked()}>
							Save
						</button>
						<button type="button" onClick={() => deleteScriptClicked()}>
							Delete
						</button>
					</div>
				)}
			</div>
			<textarea
				className="min-h-0 flex-1 resize-none rounded border p-4 font-mono text-sm"
				value={script?.content ?? ""}
				onInput={(event) => {
					scriptContentChanged(event.currentTarget.value);
				}}
				disabled={!script}
				spellCheck={false}
			/>
		</div>
	);
};
