import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
import { $tasks, $tasksLoading, $currentExecutionId, refreshTasksClicked, showAllTasks } from '../domain-tasks';
import { tasksColumns } from '../functions/columns';

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

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={tasks}
          hasMore={false}
          loading={loading}
          columns={tasksColumns}
          onLoadMore={() => {}}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
