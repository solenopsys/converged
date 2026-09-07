import { useUnit } from "effector-preact";
import { Button, Label, Play, Textarea } from "front-core";
import { openExecution } from "../domain-executions";
import {
	$lastRun,
	$runForm,
	paramsChanged,
	runClicked,
	runFormClosed,
	runWorkflowFx,
} from "../domain-workflows";

/**
 * Start a workflow by hand.
 *
 * Parameters are typed as JSON for the same reason a trigger's are: the shape
 * belongs to the workflow, and a text field is always in step with it.
 */
export function RunWorkflowView() {
	const form = useUnit($runForm);
	const running = useUnit(runWorkflowFx.pending);
	const lastRun = useUnit($lastRun);

	if (!form)
		return (
			<div className="p-4 text-muted-foreground">No workflow selected</div>
		);

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 p-4">
			<div>
				<Label>Workflow</Label>
				<div className="font-mono text-sm">{form.script}</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-1">
				<Label>Parameters</Label>
				<Textarea
					className="min-h-40 flex-1 font-mono text-sm"
					value={form.params}
					onInput={(event: any) => {
						paramsChanged(event.currentTarget.value);
					}}
				/>
				<span className="text-muted-foreground text-xs">
					JSON object passed to the workflow as its parameters
				</span>
			</div>

			{form.error && (
				<div className="text-destructive text-sm">{form.error}</div>
			)}

			{lastRun?.executionId && (
				<div className="flex items-center gap-2 rounded border p-2 text-sm">
					<span className="text-muted-foreground">Started</span>
					<span className="truncate font-mono text-xs">
						{lastRun.executionId}
					</span>
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						onClick={() => openExecution(lastRun.executionId)}
					>
						Open log
					</Button>
				</div>
			)}

			<div className="flex gap-2">
				<Button disabled={running} onClick={() => runClicked()}>
					<Play className="mr-1 h-3 w-3" />
					{running ? "Running…" : "Run"}
				</Button>
				<Button
					variant="outline"
					disabled={running}
					onClick={() => runFormClosed()}
				>
					Close
				</Button>
			</div>
		</div>
	);
}

export default RunWorkflowView;
