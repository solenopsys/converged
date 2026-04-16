import { useEffect } from "react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { Plus, RefreshCw } from "lucide-react";
import {
	$selectedScript,
	$scriptsStore,
	createScriptClicked,
	deleteScriptClicked,
	openScriptClicked,
	refreshScriptsClicked,
	saveScriptClicked,
	scriptContentChanged,
	scriptsViewMounted,
} from "../domain-scripts";
import { scriptsColumns } from "../functions/columns";
import { useUnit } from "effector-react";

export const ScriptsListView = () => {
	const scriptsState = useUnit($scriptsStore.$state);
	const selectedScript = useUnit($selectedScript);

	useEffect(() => {
		scriptsViewMounted();
	}, []);

	const createScript = () => {
		const path = window.prompt("Script path", "dag/script.ts");
		if (!path?.trim()) return;
		createScriptClicked({
			path: path.trim().replace(/^\/+/, ""),
			content: "",
		});
	};

	const headerConfig = {
		title: "Scripts",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshScriptsClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<div
				style={{
					display: "grid",
					gridTemplateRows: "minmax(0, 1fr) minmax(220px, 40%)",
					gap: 12,
					height: "100%",
				}}
			>
				<div style={{ minHeight: 0 }}>
					<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
						<button type="button" onClick={createScript}>
							<Plus size={14} /> Add script
						</button>
					</div>
					<InfiniteScrollDataTable
						data={scriptsState.items}
						hasMore={scriptsState.hasMore}
						loading={scriptsState.loading}
						columns={scriptsColumns}
						onLoadMore={$scriptsStore.loadMore}
						onRowClick={openScriptClicked}
						viewMode="table"
					/>
				</div>
				<div
					style={{
						minHeight: 0,
						display: "flex",
						flexDirection: "column",
						gap: 8,
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<strong>
							{selectedScript?.path ?? "Select or create a script"}
						</strong>
						{selectedScript && (
							<>
								<button type="button" onClick={() => saveScriptClicked()}>
									Save
								</button>
								<button type="button" onClick={() => deleteScriptClicked()}>
									Delete
								</button>
							</>
						)}
					</div>
					<textarea
						className="w-full h-full p-4 font-mono text-sm border rounded resize-none"
						value={selectedScript?.content ?? ""}
						onChange={(event) => scriptContentChanged(event.target.value)}
						disabled={!selectedScript}
						spellCheck={false}
					/>
				</div>
			</div>
		</HeaderPanelLayout>
	);
};
