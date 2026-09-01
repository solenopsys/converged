export {
	$registeredCommands,
	actionCommand,
	actionCommandActivated,
	actionCommandFx,
	actionCommandRequested,
	ActionContextManager,
	actionContext,
	actionRegistered,
	BasePlugin,
	bus,
	defineScreens,
	invokeAction,
	registry,
	actionRunFailed,
	actionRunStarted,
	actionRunSucceeded,
	canRunAction,
	onActionAuthorizationChanged,
	setActionAuthorizationController,
	setActionLoader,
	createDomainLogger,
	installEffectorTrafficLogger,
	isEffectorDebugEnabled,
	ingestMicrofrontendLlmCatalog,
} from "front-core/core";
export type {
	ActionAuthorizationController,
	ActionAuthorizationErrorCode,
	ActionCommand,
	MicrofrontendLlmCatalog,
} from "front-core/core";

export * from "./object-runtime";
export * from "./select";
export type {
	Action,
	ActionBrief,
	ActionParameters,
	ActionRegistry,
	CategorySummary,
	CreateAction,
	CreateWidget,
	PresentRequest,
	Plugin,
	ScreenDecl,
	Surface,
	Widget,
} from "front-core/core";

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
	StatisticCard,
	type StatisticCardProps,
} from "./components/ui/statistic-card";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export { Separator } from "./components/ui/separator";
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
export { Toggle, toggleVariants } from "./components/ui/toggle";
export { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
export { useIsMobile } from "./hooks/use-mobile";
export { Slot } from "./dashboard/Slot";
export { layoutReady } from "./dashboard/slots";
export {
	dashboardSlots,
	subscribeDashboardIndicators,
} from "./dashboard/dashboard-slots";
export { DashboardWidget } from "./dashboard/DashboardWidget";
export { DashboardLayout } from "./dashboard/DashboardLayout";
export {
	DashboardPieChartCard,
	type DashboardPieChartCardProps,
	type DashboardPieChartDatum,
} from "./dashboard/DashboardPieChartCard";
export {
	DashboardLineChartCard,
	type DashboardLineChartCardProps,
	type DashboardLineSeriesConfig,
	type DashboardSecondaryAxisConfig,
} from "./dashboard/DashboardLineChartCard";
export {
	CHART_COLORS,
	ERROR_COLOR,
	isErrorLike,
	PIE_COLORS,
} from "./dashboard/pie-chart-colors";
export {
	ChartContainer,
	ChartStyle,
	useChart,
	type ChartConfig,
} from "./components/ui/chart";
export {
	MetricProgressListCard,
	type MetricProgressListCardProps,
	type MetricProgressListItem,
	type MetricProgressListMetric,
} from "./components/MetricProgressListCard";
export { StatCard, renderIcon } from "./components/statcard/stat-card";
export type { BadgeData, CardData } from "./components/statcard/types";
export { StatCardView } from "./views/StatCardView";
export { getIconByName } from "./icons";
export {
	PellEditor,
	type PellEditorChange,
	type PellEditorProps,
	plainTextToEmailHtml,
	emailHtmlToPlainText,
} from "./components/ui/pell-editor";
export {
	registerDashboardWidget,
	registerDashboardWidgets,
	registerDashboardWidgetResolver,
	type DashboardWidgetEntry,
} from "./dashboard/widget-registry";
export { HeaderPanel } from "./components/HeaderPanel";
export type {
	HeaderAction,
	HeaderPanelConfig,
	HeaderPanelProps,
	HeaderTab,
	SelectionAction,
} from "./components/HeaderPanel";
export { HeaderPanelLayout } from "./components/HeaderPanelLayout";
export { Badge } from "./components/ui/badge";
export { Button, buttonVariants } from "./components/ui/button";
export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
export { cn } from "./lib/utils";
// Keep the established microfrontend facade while the table implementation
// remains its own delivery chunk (`front-core/table`).
export {
	createInfiniteTableStore,
	getTableColumns,
	InfiniteScrollDataTable,
} from "front-core/table";
export type {
	TableFilterConfig,
	TableFilterValues,
} from "front-core/table";
export * from "./icons";
export { configFromPage } from "./chat/config/from-page";
export { renderMarkdown } from "./chat/ui/markdown";
export { AppShell } from "./shell/AppShell";
export {
	$activeWorkspaceTab,
	$workspaceTabs,
	workspaceTabActivated,
	workspaceTabClosed,
	workspaceTabOpened,
	workspaceTabPinToggled,
} from "./shell/workspace";
export type { OpenWorkspaceTab, WorkspaceTab } from "./shell/workspace";
export { openRecordTab, type OpenRecordTabRequest } from "./shell/record-tabs";
export { AudioDiagram, LiveAudioDiagram, StereoCallPlayer } from "./audio";
export type { AudioDiagramTrack } from "./audio";
export {
	getTheme,
	setTheme,
	subscribeTheme,
	themeBootstrapScript,
	toggleTheme,
	type Theme,
} from "./theme";
export { authToken } from "./auth-token";
export type { AuthTokenPayload } from "./auth-token";
export { upsertSidebarTab } from "./sidebar-tabs";
export {
	$activeLocale,
	LocaleController,
	registerMicrofrontendLocales,
	resolveEmbeddedMicrofrontendMessage,
	useMicrofrontendTranslation,
} from "./i18n";
export type {
	MicrofrontendLocaleSource,
	MicrofrontendLocales,
	MicrofrontendMessages,
} from "./i18n";
export { JsonRenderer } from "./components/json-renderer";
export {
	ThreadedChat,
	type ThreadedChatProps,
} from "./components/chat/ThreadedChat";
export {
	ThreadView,
	type ThreadViewProps,
	type ThreadViewMessage,
} from "./components/chat/ThreadView";
export type {
	ThreadFlatNode,
	ThreadMessageBase,
} from "./components/chat/types";
export {
	CallTranscriptPanel,
	callSessionLabel,
	type CallTranscriptLine,
	type CallTranscriptPanelProps,
} from "./components/call-review/CallTranscriptPanel";
export {
	BasicFormView,
	type RelatedSectionConfig,
} from "./views/BasicFormView";
export {
	EntityListView,
	type EntityListTab,
	type EntityListViewProps,
} from "./views/EntityListView";
export { getAllFormFields } from "front-core/table";
