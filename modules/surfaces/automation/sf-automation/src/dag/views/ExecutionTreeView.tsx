import { useUnit } from "effector-preact";
import { Badge, Button, JsonRenderer, RefreshCw, ScrollArea } from "front-core";
import type { Execution, ExecutionTreeRow } from "g-dag";
import { useEffect } from "preact/compat";
import {
	$executionTree,
	$expandedNodes,
	$treeError,
	$treeLoading,
	nodeToggled,
	refreshExecution,
} from "../domain-executions";

const STATE_VARIANT = {
	done: "success",
	failed: "destructive",
	running: "secondary",
} as const;

/**
 * What a run did, as a tree.
 *
 * Every node is one line: how deep it sits, whether it finished, and how long
 * it took. A node that delegated through `rt.sub` is followed by the nodes of
 * the run it delegated to, one level in — which is why a row carries `depth`
 * and the view has no recursion of its own.
 *
 * The payloads stay folded. A node's input is every service call it made and
 * its result is whatever came back; unfolded by default they would bury the
 * shape of the run, which is the thing this screen exists to show.
 */
export function ExecutionTreeView() {
	const tree = useUnit($executionTree);
	const loading = useUnit($treeLoading);
	const error = useUnit($treeError);
	const expanded = useUnit($expandedNodes);

	if (error) return <div className="p-4 text-destructive">{error}</div>;
	if (!tree)
		return (
			<div className="p-4 text-muted-foreground">
				{loading ? "Loading run…" : "No run selected"}
			</div>
		);

	const byId = new Map(tree.executions.map((run) => [run.id, run]));

	return (
		<div className="flex h-full min-h-0 flex-col">
			<Header execution={tree.execution} nodes={tree.rows.length} />
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-1 p-3">
					{tree.rows.length === 0 && (
						<div className="text-muted-foreground text-sm">
							No nodes recorded yet.
						</div>
					)}
					{tree.rows.map((row) => (
						<NodeRow
							key={`${row.executionId}:${row.seq}`}
							row={row}
							child={
								row.childExecutionId
									? byId.get(row.childExecutionId)
									: undefined
							}
							open={Boolean(expanded[`${row.executionId}:${row.seq}`])}
						/>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

function Header({ execution, nodes }: { execution: Execution; nodes: number }) {
	return (
		<div className="flex items-center gap-3 border-b p-3">
			<Badge variant={STATE_VARIANT[execution.status] ?? "outline"}>
				{execution.status}
			</Badge>
			<strong className="truncate">{execution.workflow}</strong>
			<span className="text-muted-foreground text-xs">{execution.id}</span>
			<span className="text-muted-foreground text-xs">
				{nodes} node{nodes === 1 ? "" : "s"} · {duration(execution)}
			</span>
			<Button
				variant="outline"
				size="sm"
				className="ml-auto"
				onClick={() => refreshExecution()}
			>
				<RefreshCw className="mr-1 h-3 w-3" />
				Refresh
			</Button>
		</div>
	);
}

function NodeRow({
	row,
	child,
	open,
}: {
	row: ExecutionTreeRow;
	child?: Execution;
	open: boolean;
}) {
	const key = `${row.executionId}:${row.seq}`;
	const hasPayload = row.input !== undefined || row.result !== undefined;

	return (
		<div style={{ marginLeft: `${row.depth * 20}px` }}>
			<button
				type="button"
				className="flex w-full items-center gap-2 rounded border bg-card px-2 py-1 text-left hover:bg-accent"
				onClick={() => nodeToggled(key)}
			>
				<span className="w-4 text-muted-foreground text-xs">
					{hasPayload || row.error ? (open ? "▾" : "▸") : ""}
				</span>
				<Badge variant={STATE_VARIANT[row.state] ?? "outline"}>
					{row.state}
				</Badge>
				{row.kind === "sub" && <Badge variant="outline">sub</Badge>}
				<span className="truncate font-mono text-sm">{row.node}</span>
				{child && (
					<span className="truncate text-muted-foreground text-xs">
						→ {child.workflow}
					</span>
				)}
				<span className="ml-auto shrink-0 text-muted-foreground text-xs">
					{duration(row)}
				</span>
			</button>

			{open && (
				<div className="ml-6 flex flex-col gap-2 border-l py-2 pl-3">
					{row.error && (
						<div className="text-destructive text-sm">{row.error}</div>
					)}
					{row.input !== undefined && (
						<Payload
							label={row.kind === "sub" ? "Parameters" : "Calls"}
							value={row.input}
						/>
					)}
					{row.result !== undefined && (
						<Payload label="Result" value={row.result} />
					)}
				</div>
			)}
		</div>
	);
}

function Payload({ label, value }: { label: string; value: unknown }) {
	return (
		<div>
			<div className="mb-1 text-muted-foreground text-xs uppercase">
				{label}
			</div>
			<JsonRenderer data={value} />
		</div>
	);
}

/** Wall time, or how long it has been running when it has not finished. */
function duration(item: { startedAt: number; endedAt: number | null }): string {
	if (!item.startedAt) return "";
	const end = item.endedAt ?? Date.now();
	const ms = Math.max(0, end - item.startedAt);
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default ExecutionTreeView;
