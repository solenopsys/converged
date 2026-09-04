import { useUnit } from "effector-preact";
import type { Store } from "effector";
import { translator } from "i18n";
import { StatCard } from "../components/statcard/stat-card";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { useSurfaceTranslation } from "../i18n";
import type { CardData } from "../components/statcard/types";

const chrome = translator(CHAT_MESSAGES_NAMESPACE);

export const StatCardView = (viewProps: { value: Store<number>; surfaceId: string; pathCardConfig: string }) => {
	const { t, loading } = useSurfaceTranslation(viewProps.surfaceId);
	const value = useUnit(viewProps.value);

	if (loading) {
		return <div>{chrome("statCard.loadingConfig")}</div>;
	}

	const cardData = t(viewProps.pathCardConfig);

	if (!cardData || typeof cardData !== "object" || cardData === viewProps.pathCardConfig) {
		return <div>{chrome("statCard.configNotFound")}</div>;
	}

	const finalCardData = { ...(cardData as object), value } as CardData & { value: number };

	return <StatCard data={finalCardData} />;
};
