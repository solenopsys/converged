import { useUnit } from "effector-preact";
import { Button, Input, Label, Textarea, Trash2 } from "front-core";
import {
	$cronDraft,
	$cronSaving,
	cronFieldChanged,
	cronFormClosed,
	deleteCronClicked,
	saveCronClicked,
} from "../domain-crons";

/**
 * A schedule is a cron expression and what it should reach: the provider that
 * knows how to act and the action it takes. The topic is what fujin emits when
 * the expression fires, which is what a workflow trigger subscribes to.
 *
 * Parameters are raw JSON rather than a generated form: what an action accepts
 * is the action's own business and changes with it.
 */
export function CronFormView() {
	const draft = useUnit($cronDraft);
	const saving = useUnit($cronSaving);

	if (!draft)
		return (
			<div className="p-4 text-muted-foreground">No schedule selected</div>
		);

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
			<div className="flex items-center justify-between">
				<strong>{draft.id ? "Edit schedule" : "New schedule"}</strong>
				{draft.id && (
					<Button
						variant="outline"
						size="sm"
						disabled={saving}
						onClick={() => deleteCronClicked()}
					>
						<Trash2 className="mr-1 h-3 w-3" />
						Delete
					</Button>
				)}
			</div>

			<Field label="Name">
				<Input
					value={draft.name}
					placeholder="Nightly import"
					onInput={(event: any) => {
						cronFieldChanged({ name: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field
				label="Expression"
				hint="Standard cron, five fields. e.g. 0 3 * * *"
			>
				<Input
					value={draft.expression}
					placeholder="0 3 * * *"
					onInput={(event: any) => {
						cronFieldChanged({ expression: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field label="Provider">
				<Input
					value={draft.provider}
					placeholder="dag"
					onInput={(event: any) => {
						cronFieldChanged({ provider: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field label="Action">
				<Input
					value={draft.action}
					placeholder="runWorkflow"
					onInput={(event: any) => {
						cronFieldChanged({ action: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field
				label="Topic"
				hint="Emitted when the expression fires; a trigger on it starts the workflow"
			>
				<Input
					value={draft.topic}
					placeholder="cron.nightly"
					onInput={(event: any) => {
						cronFieldChanged({ topic: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field label="Timezone" hint="IANA name. Empty means the cluster's own">
				<Input
					value={draft.timezone}
					placeholder="Europe/Berlin"
					onInput={(event: any) => {
						cronFieldChanged({ timezone: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field label="Parameters" hint="JSON object, handed to the action">
				<Textarea
					className="min-h-32 font-mono text-sm"
					value={draft.params}
					onInput={(event: any) => {
						cronFieldChanged({ params: event.currentTarget.value });
					}}
				/>
			</Field>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={draft.paused}
					onChange={(event: any) => {
						cronFieldChanged({ paused: event.currentTarget.checked });
					}}
				/>
				Paused
			</label>

			{draft.error && (
				<div className="text-destructive text-sm">{draft.error}</div>
			)}

			<div className="flex gap-2">
				<Button disabled={saving} onClick={() => saveCronClicked()}>
					{saving ? "Saving…" : "Save"}
				</Button>
				<Button
					variant="outline"
					disabled={saving}
					onClick={() => cronFormClosed()}
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

export default CronFormView;
