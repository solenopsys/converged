import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Outgoing from './components/Outgoing';
import MailList from './components/MailList';
import Panel from './components/Panel';
import MailDetail from './components/MailDetail';
import mailingService from "./service";
import {  COLUMN_TYPES } from 'converged-core';
import MailForm from './components/MailForm';


  // Колонки таблицы
  const incomColumns = [
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

  const outColumns = [
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


const App = () => {
  return (
    <div  className="mf-mailing">
      
      <Routes>
        {/* Убираем index роут, так как он будет конфликтовать с родительским */}
        <Route path="/" element={<Panel />} />
        <Route path="/outgoing" element={<MailList columns={outColumns} title="Исходящие" dataFucntion={mailingService.listOutMails} />} >
           {/* Дочерний маршрут для конкретного письма */}
           <Route path=":mailid" element={<MailDetail />} />
        </Route>
        <Route path="/incoming" element={<MailList columns={incomColumns} title="Входящие" dataFucntion={mailingService.listInMails} />}>
          {/* Дочерний маршрут для конкретного письма */}
          <Route path=":mailid" element={<MailDetail />} />
        </Route>

        <Route path="/credentials" element={<MailList columns={credentialsColumns} title="Юзеры" dataFucntion={mailingService.listCredentials} />}>
          {/* Дочерний маршрут для конкретного письма */}
          <Route path=":mailid" element={<MailDetail />} />
        </Route>

        <Route path="/send" element={<MailForm />} />
        <Route path="*" element={<div>Not Found in Mailing Module</div>} />
      </Routes>
    </div>
  );
};

export default App;