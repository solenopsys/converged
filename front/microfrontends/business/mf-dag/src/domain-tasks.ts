import { createStore, createEvent, createEffect, sample } from 'effector';
import domain from './domain';
import dagService from './service';
import type { Task } from 'g-dag';

export const openTasksList = domain.createEvent<{ executionId: string }>('OPEN_TASKS_LIST');
export const showAllTasks = domain.createEvent('SHOW_ALL_TASKS');
export const refreshTasksClicked = domain.createEvent('REFRESH_TASKS_CLICKED');

export const $currentExecutionId = domain.createStore<string | null>(null)
  .on(openTasksList, (_, { executionId }) => executionId)
  .on(showAllTasks, () => null);

export const $tasks = domain.createStore<Task[]>([]);
export const $tasksLoading = domain.createStore(false);

export const loadTasksFx = domain.createEffect<string | null, Task[]>({
  handler: async (executionId) => {
    const result = await dagService.listTasks(executionId, { offset: 0, limit: 100 });
    return result.items;
  },
});

$tasksLoading.on(loadTasksFx, () => true).on(loadTasksFx.finally, () => false);
$tasks.on(loadTasksFx.doneData, (_, tasks) => tasks);

sample({
  clock: openTasksList,
  fn: ({ executionId }) => executionId,
  target: loadTasksFx,
});

sample({
  clock: showAllTasks,
  fn: () => null,
  target: loadTasksFx,
});

sample({
  clock: refreshTasksClicked,
  source: $currentExecutionId,
  target: loadTasksFx,
});
