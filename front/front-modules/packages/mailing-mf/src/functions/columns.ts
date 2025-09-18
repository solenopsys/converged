import { COLUMN_TYPES,   } from 'converged-core';


// Table columns configuration
export const credentialsColumns = [
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


  // Table columns configuration
 export  const incomingColumns = [
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
  ];


  // Table columns configuration
export const outgoingColumns = [
    {
        id: 'subject',
        title: 'Тема',
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
];


