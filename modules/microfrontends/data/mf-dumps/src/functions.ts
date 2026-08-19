import { CreateAction, CreateWidget } from 'front-core';
import { DumpsView } from './views/DumpsView';
import { StoragesView } from './views/StoragesView';

const SHOW_DUMPS = 'dumps.list.show';
const SHOW_STORAGES = 'dumps.storages.show';

const createDumpsWidget: CreateWidget<typeof DumpsView> = (_bus) => ({
  view: DumpsView,
  placement: () => 'center',
  config: { mode: 'dumps' },
});

const createStoragesWidget: CreateWidget<typeof StoragesView> = (bus) => ({
  view: StoragesView,
  placement: () => 'center',
  config: { bus },
});

const createShowDumpsAction: CreateAction<any> = (bus) => ({
  id: SHOW_DUMPS,
  description: 'Show dump files',
  invoke: () => {
    bus.present({ widget: createDumpsWidget(bus) });
  },
});

const createShowStoragesAction: CreateAction<any> = (bus) => ({
  id: SHOW_STORAGES,
  description: 'Show storage stats',
  invoke: () => {
    bus.present({ widget: createStoragesWidget(bus) });
  },
});

const ACTIONS = [createShowDumpsAction, createShowStoragesAction];

export { SHOW_DUMPS, SHOW_STORAGES, createShowDumpsAction, createShowStoragesAction };
export default ACTIONS;
