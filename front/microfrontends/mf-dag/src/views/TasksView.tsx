import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanel, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
import { $tasks, $tasksLoading, $currentExecutionId, refreshTasksClicked } from '../domain-tasks';
import { tasksColumns } from '../functions/columns';

export const TasksView = ({ bus, executionId }: { bus: any; executionId?: string }) => {
  const tasks = useUnit($tasks);
  const loading = useUnit($tasksLoading);
  const currentId = useUnit($currentExecutionId);

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
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={tasks}
          hasMore={false}
          loading={loading}
          columns={tasksColumns}
          onLoadMore={() => {}}
          viewMode="table"
        />
      </div>
    </div>
  );
};
