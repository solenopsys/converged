import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
import { $tasks, $tasksLoading, $currentExecutionId, refreshTasksClicked, showAllTasks } from '../domain-tasks';
import { createContextWidget } from '../functions/context';
import { openContextDetail, $selectedContext } from '../domain-contexts';
import { tasksColumns } from '../functions/columns';
import ContextView from './ContextView';
import domain from '../domain';
import dagService from '../service';

const $selectedTask = domain.createStore<any>(null);
const selectTask = domain.createEvent<any>('SELECT_TASK');
$selectedTask.on(selectTask, (_, task) => task);

export const TasksView = ({ bus }: { bus: any }) => {
  const tasks = useUnit($tasks);
  const loading = useUnit($tasksLoading);
  const currentId = useUnit($currentExecutionId);

  useEffect(() => {
    showAllTasks();
  }, []);

  const headerConfig = {
    title: `Tasks${currentId ? `: ${currentId.slice(0, 8)}...` : ''}`,
    actions: [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshTasksClicked,
        variant: 'outline' as const,
      },
    ],
  };

  const handleRowClick = async (task: any) => {
    selectTask(task);
    bus.present({
      widget: {
        view: ContextView,
        placement: () => 'sidebar:tab:dag',
        config: { contextStore: $selectedTask },
        commands: {},
      },
    });

    try {
      const details = await dagService.statusExecution(task.executionId);
      const fullTask = details?.tasks?.find((item: any) => item.id === task.id);
      if (fullTask) {
        selectTask(fullTask);
      }
    } catch (error) {
      console.error('[mf-dag] failed to load task details', error);
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
