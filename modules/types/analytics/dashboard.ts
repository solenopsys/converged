export type DashboardPinId = string;
export type ISODateString = string;

export type DashboardIndicatorPin = {
	id: DashboardPinId;
	widgetId: string;
	title?: string;
	source?: string;
	componentKey?: string;
	position: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type DashboardIndicatorPinInput = {
	widgetId: string;
	title?: string;
	source?: string;
	componentKey?: string;
	position?: number;
};

/** A serialized last-known chart payload, indexed by `modulename.graphicname`. */
export type DashboardChartCache = {
	key: string;
	data: unknown;
	updatedAt: string;
};

export interface DashboardService {
	pinIndicator(
		input: DashboardIndicatorPinInput,
	): Promise<DashboardIndicatorPin>;
	unpinIndicator(widgetId: string): Promise<void>;
	listIndicators(): Promise<DashboardIndicatorPin[]>;
	clearIndicators(): Promise<void>;
	getChartCache(key: string): Promise<DashboardChartCache | null>;
	setChartCache(key: string, data: unknown): Promise<void>;
}
