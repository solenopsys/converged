import { useUnit } from "effector-preact";
import type { Store } from "effector";
import { StatCard } from "../components/statcard/stat-card";
import { useMicrofrontendTranslation } from "../i18n";
import type { CardData } from "../components/statcard/types";

export const StatCardView = (viewProps: { value: Store<number>; microfrontendId: string; pathCardConfig: string }) => {
	const { t, loading } = useMicrofrontendTranslation(viewProps.microfrontendId);
	const value = useUnit(viewProps.value);

	if (loading) {
		return <div>Загрузка конфигурации карточки...</div>;
	}

	const cardData = t(viewProps.pathCardConfig);

	if (!cardData || typeof cardData !== "object" || cardData === viewProps.pathCardConfig) {
		return <div>Конфигурация карточки не найдена</div>;
	}

	const finalCardData = { ...(cardData as object), value } as CardData & { value: number };

	return <StatCard data={finalCardData} />;
};
