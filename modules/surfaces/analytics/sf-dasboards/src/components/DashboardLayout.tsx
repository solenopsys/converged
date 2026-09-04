import {
	HeaderPanelLayout,
	ScrollArea,
	StatisticsDashboard,
	useSurfaceTranslation,
} from "front-core";

const DASHBOARDS_SF_ID = "dasboards-sf";

/**
 * The admin's single dashboard. It owns no charts of its own: every block comes
 * from the object catalog's `core.statistic` types, grouped back into a section
 * per surface. Sections start collapsed, so opening the page costs
 * nothing until the user asks for a service.
 */
export const DashboardLayout = () => {
	const { t } = useSurfaceTranslation(DASHBOARDS_SF_ID);

	return (
		<HeaderPanelLayout config={{ title: t("dashboard.title") as string }}>
			<ScrollArea className="h-full">
				<StatisticsDashboard />
			</ScrollArea>
		</HeaderPanelLayout>
	);
};
