export type {
	Action,
	ActionAuthorizationController,
	ActionAuthorizationErrorCode,
	ActionBrief,
	ActionCommand,
	ActionParameters,
	ActionRegistry,
	CategorySummary,
	CreateAction,
	CreateWidget,
	MicrofrontendLlmCatalog,
	Plugin,
	PresentRequest,
	ScreenDecl,
	Surface,
	Widget,
} from "front-core/core";
export {
	$registeredCommands,
	ActionContextManager,
	actionCommand,
	actionCommandActivated,
	actionCommandFx,
	actionCommandRequested,
	actionContext,
	actionRegistered,
	actionRunFailed,
	actionRunStarted,
	actionRunSucceeded,
	BasePlugin,
	bus,
	canRunAction,
	createDomainLogger,
	defineScreens,
	ingestMicrofrontendLlmCatalog,
	installEffectorTrafficLogger,
	invokeAction,
	isEffectorDebugEnabled,
	onActionAuthorizationChanged,
	registry,
	setActionAuthorizationController,
	setActionLoader,
} from "front-core/core";
export type {
	TableFilterConfig,
	TableFilterValues,
} from "front-core/table";
// Keep the established microfrontend facade while the table implementation
// remains its own delivery chunk (`front-core/table`).
export {
	createInfiniteTableStore,
	getAllFormFields,
	getTableColumns,
	InfiniteScrollDataTable,
} from "front-core/table";
export type { AudioDiagramTrack } from "./audio";
export { AudioDiagram, LiveAudioDiagram, StereoCallPlayer } from "./audio";
export type { AuthTokenPayload } from "./auth-token";
export { authToken } from "./auth-token";
export { configFromPage } from "./chat/config/from-page";
export { renderMarkdown } from "./chat/ui/markdown";
export {
	type CallTranscriptLine,
	CallTranscriptPanel,
	type CallTranscriptPanelProps,
	callSessionLabel,
} from "./components/call-review/CallTranscriptPanel";
export {
	ThreadedChat,
	type ThreadedChatProps,
} from "./components/chat/ThreadedChat";
export {
	ThreadView,
	type ThreadViewMessage,
	type ThreadViewProps,
} from "./components/chat/ThreadView";
export type {
	ThreadFlatNode,
	ThreadMessageBase,
} from "./components/chat/types";
export type {
	HeaderAction,
	HeaderPanelConfig,
	HeaderPanelProps,
	HeaderTab,
	SelectionAction,
} from "./components/HeaderPanel";
export { HeaderPanel } from "./components/HeaderPanel";
export { HeaderPanelLayout } from "./components/HeaderPanelLayout";
export { JsonRenderer } from "./components/json-renderer";
export {
	MetricProgressListCard,
	type MetricProgressListCardProps,
	type MetricProgressListItem,
	type MetricProgressListMetric,
} from "./components/MetricProgressListCard";
export { renderIcon, StatCard } from "./components/statcard/stat-card";
export type { BadgeData, CardData } from "./components/statcard/types";
export { Badge } from "./components/ui/badge";
export { Button, buttonVariants } from "./components/ui/button";
export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	type DashboardPinMeta,
} from "./components/ui/card";
export {
	type ChartConfig,
	ChartContainer,
	ChartStyle,
	useChart,
} from "./components/ui/chart";
export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export {
	emailHtmlToPlainText,
	PellEditor,
	type PellEditorChange,
	type PellEditorProps,
	plainTextToEmailHtml,
} from "./components/ui/pell-editor";
export { Progress } from "./components/ui/progress";
export { ScrollArea, ScrollBar } from "./components/ui/scroll-area";
export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "./components/ui/select";
export { Separator } from "./components/ui/separator";
export {
	StatisticCard,
	type StatisticCardProps,
} from "./components/ui/statistic-card";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
export { Toggle, toggleVariants } from "./components/ui/toggle";
export { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
export { DashboardLayout } from "./dashboard/DashboardLayout";
export {
	DashboardLineChartCard,
	type DashboardLineChartCardProps,
	type DashboardLineSeriesConfig,
	type DashboardSecondaryAxisConfig,
} from "./dashboard/DashboardLineChartCard";
export {
	DashboardPieChartCard,
	type DashboardPieChartCardProps,
	type DashboardPieChartDatum,
} from "./dashboard/DashboardPieChartCard";
export { DashboardWidget } from "./dashboard/DashboardWidget";
export {
	dashboardSlots,
	subscribeDashboardIndicators,
} from "./dashboard/dashboard-slots";
export {
	CHART_COLORS,
	ERROR_COLOR,
	isErrorLike,
	PIE_COLORS,
} from "./dashboard/pie-chart-colors";
export { Slot } from "./dashboard/Slot";
export {
	formatSummaryValue,
	Sparkline,
	StatisticSummary,
	SummaryMetric,
} from "./dashboard/StatisticSummary";
export { StatisticsDashboard } from "./dashboard/StatisticsDashboard";
export { layoutReady } from "./dashboard/slots";
export {
	collectStatisticSections,
	loadStatisticSection,
	type MountableStatistic,
	resolveStatistic,
	type StatisticSection,
	type StatisticSlotSize,
	type StatisticWidget,
	sectionLabel,
} from "./dashboard/statistic-catalog";
export {
	type DashboardWidgetEntry,
	registerDashboardWidget,
	registerDashboardWidgetResolver,
	registerDashboardWidgets,
} from "./dashboard/widget-registry";
export { useIsMobile } from "./hooks/use-mobile";
export type {
	MicrofrontendLocaleSource,
	MicrofrontendLocales,
	MicrofrontendMessages,
} from "./i18n";
export {
	$activeLocale,
	LocaleController,
	registerMicrofrontendLocales,
	resolveEmbeddedMicrofrontendMessage,
	useMicrofrontendTranslation,
} from "./i18n";
export * from "./icons";
export { getIconByName } from "./icons";
export { cn } from "./lib/utils";
export * from "./object-runtime";
export * from "./select";
export { AppShell } from "./shell/AppShell";
export { type OpenRecordTabRequest, openRecordTab } from "./shell/record-tabs";
export type { OpenWorkspaceTab, WorkspaceTab } from "./shell/workspace";
export {
	$activeWorkspaceTab,
	$workspaceTabs,
	workspaceTabActivated,
	workspaceTabClosed,
	workspaceTabOpened,
	workspaceTabPinToggled,
} from "./shell/workspace";
export { upsertSidebarTab } from "./sidebar-tabs";
export {
	getTheme,
	setTheme,
	subscribeTheme,
	type Theme,
	themeBootstrapScript,
	toggleTheme,
} from "./theme";
export {
	BasicFormView,
	type RelatedSectionConfig,
} from "./views/BasicFormView";
export {
	type EntityListTab,
	EntityListView,
	type EntityListViewProps,
} from "./views/EntityListView";
export { StatCardView } from "./views/StatCardView";
