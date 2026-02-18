import { StatCard } from "../components/statcard/stat-card";
import { useUnit } from "effector-react";
import { Store } from "effector";
import { useMicrofrontendTranslation } from "../hooks/global_i18n";

export const StatCardView = (viewProps: { value: Store<number>, microfrontendId: string, pathCardConfig: string }) => {
    const { t, loading } = useMicrofrontendTranslation(viewProps.microfrontendId);
    const value = useUnit(viewProps.value);

    if (loading) {
        return <div>Загрузка конфигурации карточки...</div>
    }

    const cardData = t(viewProps.pathCardConfig);

    if (!cardData || typeof cardData !== 'object' || cardData === viewProps.pathCardConfig) {
        return <div>Конфигурация карточки не найдена</div>
    }

    const finalCardData = { ...cardData, value };

    return <StatCard data={finalCardData} />
}
