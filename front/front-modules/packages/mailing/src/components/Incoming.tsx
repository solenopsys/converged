import React, { useState, useEffect, useMemo } from 'react';
import { useMicrofrontendTranslation } from 'converged-core';
import { ID } from '../config';
import mailingService from "../service";
import { UniversalDataTable, COLUMN_TYPES } from 'converged-core';

const Incoming = () => {
  const [mails, setMails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { t, translations, loading: translationsLoading } = useMicrofrontendTranslation(ID);

  useEffect(() => {
    const fetchMails = async () => {
      try {
        setLoading(true);
        setError(null);
        const mails = await mailingService.listMails({ limit: 50, offset: 0 });
        setMails(mails);
      } catch (err) {
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    fetchMails();
  }, []);

  // Колонки таблицы
  const columns = [
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
    },
    {
      id: 'warm',
      title: 'Warm',
      type: COLUMN_TYPES.BOOLEAN
    }
  ];

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
    <div className="h-screen">
      <UniversalDataTable
        columns={columns}
        dataProvider={dataProvider}
      />
    </div>
  );
};

export default Incoming;