import { TableView } from "converged-core";
import mailingService from "../service";
import { COLUMN_TYPES, Widget, Action,present } from 'converged-core';
import { createEffect, createEvent,sample } from "effector";
import { PaginationParams } from "converged-core";

// Events and Effects
 

const listCredentals = async (params: PaginationParams) => {
    return await mailingService.listCredentials(params);
};

export const openCredentialDetail = createEvent<{ credentialId: string }>();
export const listCredentialsRequest = createEvent<{ page?: number; after?: string }>();

// Table columns configuration
const credentialsColumns = [
  {
    id: 'username',
    title: 'Имя пользователя',
    type: COLUMN_TYPES.TEXT
  },
  {
    id: 'email',
    title: 'Email',
    type: COLUMN_TYPES.TEXT
  },
  {
    id: 'password',
    title: 'Пароль',
    type: COLUMN_TYPES.TEXT
  },
  {
    id: 'group_name',
    title: 'Группа',
    type: COLUMN_TYPES.TEXT
  },
  {
    id: 'fio',
    title: 'ФИО',
    type: COLUMN_TYPES.TEXT
  }
];

// Widget
const CredentialsWidget: Widget<typeof TableView> = {
  view: TableView,
  placement: (ctx) => "center",
  config: { columns: credentialsColumns,
    title: "Пользователи",
    dataFunction: listCredentals,
    basePath: "/incoming",
    detailPath: "/mailing/incoming",
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100]
   },
  mount: ()=>{},
  commands: {
    rowClick: ({ id }) => openCredentialDetail({ credentialId: id }),
    loadPage: ({ page, after }) => listCredentialsRequest({ page, after })
  }
};

// Actions
const GetCredentialsAction: Action = {
  id: "credentials.get",
  description: "Получить список логинов и паролей",
  invoke: ({ page, after }) => listCredentialsRequest({ page, after })
};

const ShowCredentialsAction: Action = {
  id: "credentials.show",
  description: "Просмотреть список логинов и паролей",
  invoke: () => {
    present(CredentialsWidget,CredentialsWidget.placement({}));
  }
};

const ShowCredentialDetailAction: Action = {
  id: "credential_detail.show",
  description: "Просмотр деталей учетной записи",
  invoke: ({ credentialId }) => {
    openCredentialDetail({ credentialId });
    // present(CredentialDetailWidget); // если есть виджет для деталей
  }
};

 
export {
  CredentialsWidget,

  GetCredentialsAction,
  ShowCredentialsAction,
  ShowCredentialDetailAction
}
export default [
  GetCredentialsAction,
  ShowCredentialsAction,
  ShowCredentialDetailAction
];
