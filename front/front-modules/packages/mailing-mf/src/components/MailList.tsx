import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMicrofrontendTranslation } from 'converged-core';
import { ID } from '../config';

import { UniversalDataTable } from 'converged-core';
import { 
  SidebarProvider, 
  SidebarInset, 
  SidebarTrigger 
} from 'converged-core';
import MailSidebar from './MailSidebar';

const MailList = ({columns,title,dataFucntion}) => {
  const [mails, setMails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Проверяем, открыта ли боковая панель (есть ли дочерний маршрут)
  const isSidebarOpen = location.pathname !== '/incoming';

  const { t, translations, loading: translationsLoading } = useMicrofrontendTranslation(ID);

  useEffect(() => {
    const fetchMails = async () => {
      try {
        setLoading(true);
        setError(null);
        const mails = await dataFucntion({ limit: 50, offset: 0 });
        setMails(mails);
      } catch (err) {
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    fetchMails();
  }, []);

  // Функция для открытия письма
  const handleRowClick = (row) => {
    console.log(row);
    navigate(`/mailing/incoming/${row.id}`);
  };



  // Провайдер данных
  const dataProvider = useMemo(() => {
    return () => {
      if (!mails?.items) return [];
      return mails.items;
    };
  }, [mails]);

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <SidebarProvider open={isSidebarOpen}>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          {isSidebarOpen && (
            <SidebarTrigger className="-mr-1 ml-auto rotate-180" />
          )}
        </header>
        
        <div className="flex flex-1 flex-col p-4">
          <div className="h-full">
            <UniversalDataTable
              columns={columns}
              dataProvider={dataProvider}
              onRowClick={handleRowClick}
            />
          </div>
        </div>
      </SidebarInset>
      
      {isSidebarOpen && <MailSidebar side="right" />}
    </SidebarProvider>
  );
};

export default MailList;