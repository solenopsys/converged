import React, { useState, useEffect, useMemo } from "react";
 
import { SectionCards } from "converged-core"; 
import dagClient from "../service";
import { useMicrofrontendTranslation } from "converged-core";
 
import { ID } from "../config";

function Panel() {
  // Перенес хук внутрь компонента
  const { t, translations, loading: translationsLoading } = useMicrofrontendTranslation(ID);
  const [workflowsStatistic, setWorkflowsStatistic] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  //const { i18n } = useGlobalTranslation();

  useEffect(() => {
    const fetchStatistic = async () => {
      try {
        setLoading(true);
        setError(null); 
        setWorkflowsStatistic((await dagClient.workflowList()).names.length);

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
    if (!workflowsStatistic || !translations?.cards) return [];

    // Используем translations напрямую для получения полных объектов
    const workflows = {
      ...translations.cards.workflows,
      value: workflowsStatistic
    };

 
    return [workflows];
  }, [workflowsStatistic, translations]);

  // Показываем загрузку
  if (loading) {
    return <div>Загрузка...</div>;
  }

  // Показываем ошибку
  if (error) {
    return <div>Ошибка: {error}</div>;
  }

  console.log("CARDS_DATA", cardsData)
 

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 md:gap-6">
          Ok
          <SectionCards cardsData={cardsData} />
        </div>
      </div>
    </div>
  );
}

export default Panel;