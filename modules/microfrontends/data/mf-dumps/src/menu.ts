import { SHOW_DUMPS, SHOW_STORAGES } from './functions';

export const MENU = {
  title: 'menu.dumps',
  iconName: 'IconDatabase',
  items: [
    {
      title: 'menu.dumps.files',
      key: 'dumps',
      action: SHOW_DUMPS,
    },
    {
      title: 'menu.dumps.storages',
      key: 'storages',
      action: SHOW_STORAGES,
    },
  ],
};
