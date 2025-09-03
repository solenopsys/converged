

import Player from "./components/Player";
import {COLUMN_TYPES} from "converged-core";

import { UniversalDataTable } from "converged-core";
import { Play, Pause, Square, Volume2, Upload, Trash2, Music, Eye, Edit3 } from 'lucide-react';
import { chatsService } from "converged-core";

     

const outgoingColumns =    [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.NUMBER, width: 80 },
    { id: 'title', title: 'Заголовок чата', type: COLUMN_TYPES.TEXT, minWidth: 200 },
    { id: 'contact', title: 'Контакт', type: COLUMN_TYPES.TEXT, width: 150 },
    { 
      id: 'ticketLink', 
      title: 'Ссылка на заявку', 
      type: COLUMN_TYPES.TEXT, 
      width: 150
    },
    { 
      id: 'type', 
      title: 'Тип', 
      type: COLUMN_TYPES.STATUS, 
      width: 120,
      statusConfig: {
        useful: { label: 'Полезный', variant: 'default' },
        useless: { label: 'Бесполезный', variant: 'destructive' }
      }
    },
    { id: 'date', title: 'Дата', type: COLUMN_TYPES.DATE, width: 120 },
    { 
      id: 'actions', 
      title: 'Действия', 
      type: COLUMN_TYPES.ACTIONS, 
      width: 80,
      sortable: false,
      actions: [
        { id: 'view', label: 'Просмотр', icon: Eye },
        { id: 'edit', label: 'Редактировать', icon: Edit3 },
        { id: 'delete', label: 'Удалить', icon: Trash2, variant: 'danger' }
      ]
    }
  ];


  const OpenTrackCap = {
    description: "Открытие трека",
    views: [Player],
    show: ["right"]

}


const ListOfChatsCap = {
    description: "Просмотреть список отправленных писем",
    menu: "menu.outgoing",
    views: [UniversalDataTable],
    show: ["center"],
    commands: { "rowClick": { name: open, params: { "recordId": "row.id" } },
    "delete": { name: open, params: { "recordId": "row.id" } } },
    dataSource: chatsService.listOfChats,
    config: {
        columns: outgoingColumns
    }
}

export const CAPABILITIES = {
    "open_track": OpenTrackCap,
    "list_of_chats": ListOfChatsCap
}