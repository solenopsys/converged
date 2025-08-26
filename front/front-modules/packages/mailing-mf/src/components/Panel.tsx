import React, { useState, useEffect, useMemo } from "react";
import { ChartAreaInteractive } from "converged-core";
import { DataTable } from "converged-core";
import { SectionCards } from "converged-core";
//import { useGlobalTranslation } from "@/hooks/global_i18n";
import mailingService from "../service";
import { useMicrofrontendTranslation } from "converged-core";
import { ID } from "../config";

function Panel() {
  // Перенес хук внутрь компонента
  const { t, translations, loading: translationsLoading } = useMicrofrontendTranslation(ID);
  const [mailingStatistic, setMailingStatistic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  //const { i18n } = useGlobalTranslation();

  useEffect(() => {
    const fetchStatistic = async () => {
      try {
        setLoading(true);
        setError(null);
        const statistic = await mailingService.getStatistic();
        setMailingStatistic(statistic);
      } catch (err) {
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistic();
  }, []); // Убрал mailingService из зависимостей

  // Используем useMemo для создания cardsData
  const cardsData = useMemo(() => {
    if (!mailingStatistic || !translations?.cards) return [];

    // Используем translations напрямую для получения полных объектов
    const mails = {
      ...translations.cards.mails,
      value: mailingStatistic.mailCount
    };

    const warms = {
      ...translations.cards.warms, 
      value: mailingStatistic.warmedMailCount
    };

    return [mails, warms];
  }, [mailingStatistic, translations]);

  // Показываем загрузку
  if (loading) {
    return <div>Загрузка...</div>;
  }

  // Показываем ошибку
  if (error) {
    return <div>Ошибка: {error}</div>;
  }

  // Показываем данные только когда они загружены
  if (!mailingStatistic) {
    return <div>Нет данных</div>;
  }

  // const tableData = i18n.getResource(i18n.language, 'table_data') || [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 md:gap-6">
          <SectionCards cardsData={cardsData} />
        </div>
      </div>
    </div>
  );
}

export default Panel;