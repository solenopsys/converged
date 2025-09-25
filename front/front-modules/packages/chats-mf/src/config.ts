import { COLUMN_TYPES,  } from "converged-core";


// Table columns configuration
export  const chatsColumns = [
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