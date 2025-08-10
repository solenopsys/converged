import React, { useState, useEffect, useMemo } from "react";
import { ChartAreaInteractive } from "converged-core";
import { DataTable } from "converged-core";
import { SectionCards } from "converged-core";
//import { useGlobalTranslation } from "@/hooks/global_i18n";
import mailingService from "./service";

function Panel() {
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
  }, [mailingService]);

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

  const cardsData = [
    {
      "title": "Писем",
      "value": mailingStatistic.mailCount,
      "badge": {
        "iconName": "IconTrendingUp",
        "text": "+15.3%",
        "className": ""
      },
      "footerTitle": "Рост числа заявок",
      "footerIconName": "IconTrendingUp",
      "footerDescription": "Новых заявок за последнюю неделю"
    },
    {
      "title": "Прогревочных",
      "value": mailingStatistic.warmedMailCount,
      "badge": {
        "iconName": "IconPackage",
        "text": "8 новых",
        "className": "bg-green-50 dark:bg-green-950"
      },
      "footerTitle": "Активных заказов в работе",
      "footerIconName": "IconPackage",
      "footerDescription": "Требуют обработки и согласования"
    }
  ];

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