import { createStore, createEvent, createEffect, sample } from 'effector';
import domain from './domain';
import dagService from './service';

export const showVars = domain.createEvent('SHOW_VARS');
export const refreshVarsClicked = domain.createEvent('REFRESH_VARS_CLICKED');
export const deleteVarClicked = domain.createEvent<string>('DELETE_VAR_CLICKED');

export const $vars = domain.createStore<{ key: string; value: any }[]>([]);
export const $varsLoading = domain.createStore(false);

export const loadVarsFx = domain.createEffect<void, { key: string; value: any }[]>({
  handler: async () => {
    const result = await dagService.listVars();
    return result.items;
  },
});

export const deleteVarFx = domain.createEffect<string, void>({
  handler: async (key) => {
    await dagService.deleteVar(key);
  },
});

$varsLoading.on(loadVarsFx, () => true).on(loadVarsFx.finally, () => false);
$vars.on(loadVarsFx.doneData, (_, vars) => vars);

sample({ clock: showVars, target: loadVarsFx });
sample({ clock: refreshVarsClicked, target: loadVarsFx });
sample({ clock: deleteVarClicked, target: deleteVarFx });
sample({ clock: deleteVarFx.done, target: loadVarsFx });
