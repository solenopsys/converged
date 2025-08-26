import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Outgoing from './components/Outgoing';
import {TableView} from  'converged-core';
import Panel from './components/Panel';
import MailDetail from './components/MailDetail';
import mailingService from "./service";
import {  COLUMN_TYPES } from 'converged-core';
import MailForm from './components/MailForm';
import MailSidebar from './components/MailSidebar';

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
    <div className="mf-mailing">
      <Routes>
        <Route path="/" element={<Panel />} />
        
        <Route 
          path="/outgoing" 
          element={
            <TableView 
              SidebarComponent={MailSidebar} 
              columns={outColumns} 
              title="Исходящие" 
              dataFunction={mailingService.listOutMails}
              basePath="/mailing/outgoing"
              detailPath="/mailing/outgoing"
            />
          } 
        >
          <Route path=":mailid" element={<MailDetail />} />
        </Route>
        
        <Route 
          path="/incoming" 
          element={
            <TableView 
              SidebarComponent={MailSidebar} 
              columns={incomColumns} 
              title="Входящие" 
              dataFunction={mailingService.listInMails}
              basePath="/mailing/incoming"
              detailPath="/mailing/incoming"
            />
          }
        >
          <Route path=":mailid" element={<MailDetail />} />
        </Route>

        <Route 
          path="/warm" 
          element={
            <TableView 
              SidebarComponent={MailSidebar} 
              columns={incomColumns} 
              title="Прогревочные" 
              dataFunction={mailingService.listWarmMails}
              basePath="/mailing/warm"
              detailPath="/mailing/warm"
            />
          }
        >
          <Route path=":mailid" element={<MailDetail />} />
        </Route>

        <Route 
          path="/credentials" 
          element={
            <TableView 
              SidebarComponent={MailSidebar} 
              columns={credentialsColumns} 
              title="Юзеры" 
              dataFunction={mailingService.listCredentials}
              basePath="/mailing/credentials"
              detailPath="/mailing/credentials"
            />
          }
        >
          <Route path=":mailid" element={<MailDetail />} />
        </Route>

        <Route path="/send" element={<MailForm />} />
        <Route path="*" element={<div>Not Found in Mailing Module</div>} />
      </Routes>
    </div>
  );
};

export default App;