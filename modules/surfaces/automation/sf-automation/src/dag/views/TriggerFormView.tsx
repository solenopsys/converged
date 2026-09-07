import { useUnit } from "effector-preact";
import { Button, Input, Label, Textarea, Trash2 } from "front-core";
import {
	$triggerDraft,
	$triggerSaving,
	deleteTriggerClicked,
	saveTriggerClicked,
	triggerFieldChanged,
	triggerFormClosed,
} from "../domain-triggers";

/**
 * A trigger is four fields: the topic to watch, the workflow to run, the
 * parameters to merge in, and whether it is on.
 *
 * Parameters are raw JSON rather than a generated form. A workflow's parameters
 * are its own business and change with it; a text field stays correct when they
 * do, and what the operator types is exactly what the workflow receives.
 */
export function TriggerFormView() {
	const draft = useUnit($triggerDraft);
	const saving = useUnit($triggerSaving);

	if (!draft)
		return <div className="p-4 text-muted-foreground">No trigger selected</div>;

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
			<div className="flex items-center justify-between">
				<strong>{draft.id ? "Edit trigger" : "New trigger"}</strong>
				{draft.id && (
					<Button
						variant="outline"
						size="sm"
						disabled={saving}
						onClick={() => deleteTriggerClicked()}
					>
						<Trash2 className="mr-1 h-3 w-3" />
						Delete
					</Button>
				)}
			</div>

			<Field label="Name">
				<Input
					value={draft.name}
					placeholder="Invoice on payment"
					onInput={(event: any) => {
						triggerFieldChanged({ name: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field
				label="Topic"
				hint="Bus pattern: * matches one segment, > matches the rest. e.g. order.paid.>"
			>
				<Input
					value={draft.topic}
					placeholder="order.paid.>"
					onInput={(event: any) => {
						triggerFieldChanged({ topic: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field label="Workflow" hint="The script path, as the catalogue lists it">
				<Input
					value={draft.script}
					placeholder="workflows/wf-invoice.js"
					onInput={(event: any) => {
						triggerFieldChanged({ script: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field
				label="Parameters"
				hint="JSON object, merged under the event when the workflow starts"
			>
				<Textarea
					className="min-h-32 font-mono text-sm"
					value={draft.params}
					onInput={(event: any) => {
						triggerFieldChanged({ params: event.currentTarget.value });
					}}
				/>
			</Field>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={draft.enabled}
					onChange={(event: any) => {
						triggerFieldChanged({ enabled: event.currentTarget.checked });
					}}
				/>
				Enabled
			</label>

			{draft.error && (
				<div className="text-destructive text-sm">{draft.error}</div>
			)}

			<div className="flex gap-2">
				<Button disabled={saving} onClick={() => saveTriggerClicked()}>
					{saving ? "Saving…" : "Save"}
				</Button>
				<Button
					variant="outline"
					disabled={saving}
					onClick={() => triggerFormClosed()}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: any;
}) {
	return (
		<div className="flex flex-col gap-1">
			<Label>{label}</Label>
			{children}
			{hint && <span className="text-muted-foreground text-xs">{hint}</span>}
		</div>
	);
}

export default TriggerFormView;
