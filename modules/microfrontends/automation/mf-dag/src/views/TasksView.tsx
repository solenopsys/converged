import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	RefreshCw,
} from "front-core";
import React, { useEffect } from "preact/compat";
import domain from "../domain";
import { $selectedContext, openContextDetail } from "../domain-contexts";
import {
	$currentExecutionId,
	$tasks,
	$tasksLoading,
	refreshTasksClicked,
	showAllTasks,
} from "../domain-tasks";
import { tasksColumns } from "../functions/columns";
import { createContextWidget } from "../functions/context";
import dagService from "../service";
import ContextView from "./ContextView";

const $selectedTask = domain.createStore<any>(null);
const selectTask = domain.createEvent<any>("SELECT_TASK");
$selectedTask.on(selectTask, (_, task) => task);

export const TasksView = ({ bus }: { bus: any }) => {
	const tasks = useUnit($tasks);
	const loading = useUnit($tasksLoading);
	const currentId = useUnit($currentExecutionId);

	useEffect(() => {
		showAllTasks();
	}, []);

	const headerConfig = {
		title: `Tasks${currentId ? `: ${currentId.slice(0, 8)}...` : ""}`,
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshTasksClicked,
				variant: "outline" as const,
			},
		],
	};

	const handleRowClick = async (task: any) => {
		selectTask(task);
		bus.present({
			widget: {
				view: ContextView,
				placement: () => "sidebar:tab:dag",
				config: { contextStore: $selectedTask },
				commands: {},
			},
			tab: { key: `dag.task:${task.id}`, title: task.name ?? task.id },
		});

		try {
			const details = await dagService.statusExecution(task.executionId);
			const fullTask = details?.tasks?.find((item: any) => item.id === task.id);
			if (fullTask) {
				selectTask(fullTask);
			}
		} catch (error) {
			console.error("[mf-dag] failed to load task details", error);
		}
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={tasks}
				hasMore={false}
				loading={loading}
				columns={tasksColumns}
				onRowClick={handleRowClick}
				onLoadMore={() => {}}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
