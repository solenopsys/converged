

import { TableView } from "converged-core";
import mailingService from "../service";

import { COLUMN_TYPES } from 'converged-core';

const outgoingColumns = [
    {
        id: 'subject',
        title: 'Тема', //todo в транслитерацию
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'from',
        title: 'От кого',
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'to',
        title: 'Кому',
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'date',
        title: 'Дата',
        type: COLUMN_TYPES.DATE
    }
]

const OutgoingMailsCap = {
    description: "Просмотреть список отправленных писем",
    menu: "menu.outgoing",
    views: [TableView],
    show: ["center"],
    commands: { "rowClick": { name: open, params: { "mailid": "row.id" } } },
    dataSource: mailingService.listOutMails,
    config: {
        columns: outgoingColumns
    }
}

const incomingColumns = [
  {
    id: 'subject',
    title: 'Тема',
    type: COLUMN_TYPES.TEXT
  },
  {
    id: 'sender',
    title: 'От кого',
    type: COLUMN_TYPES.TEXT
  },
  {
    id: 'recipient',
    title: 'Кому',
    type: COLUMN_TYPES.TEXT
  },
  {
    id: 'date',
    title: 'Дата',
    type: COLUMN_TYPES.DATE
  }
]


const IcomingMailsCap = {
  description: "Просмотреть список входящих писем",
  menu: "menu.incoming",
  views: [TableView],
  show: ["center"],
  commands: { commands: { "rowClick": { name: open, params: { "mailid": "row.id" } } } },
  dataSource: mailingService.listInMails,
  config: {
    columns: incomingColumns
  }
}

const WarmMailsCap = {
  description: "Просмотреть список прогревочных писем",
  menu: "menu.warm",
  views: [TableView],
  show: ["center"],
  commands: { commands: { "rowClick": { name: open, params: { "mailid": "row.id" } } } },
  dataSource: mailingService.listWarmMails,
  config: {
    columns: incomingColumns
  }
}


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


  const CredentialsCap = {
    description: "Просмотреть список логинов и паролей",
    menu: "menu.credentials",
    views: [TableView],
    show: ["center"],
    commands: { commands: { "rowClick": { name: open, params: { "mailid": "row.id" } } } },
    dataSource: mailingService.listCredentials,
    config: {
      columns: credentialsColumns
    }
  }

 
export { IcomingMailsCap, WarmMailsCap ,CredentialsCap,OutgoingMailsCap};
