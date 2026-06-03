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

export interface DashboardService {
	pinIndicator(
		input: DashboardIndicatorPinInput,
	): Promise<DashboardIndicatorPin>;
	unpinIndicator(widgetId: string): Promise<void>;
	listIndicators(): Promise<DashboardIndicatorPin[]>;
	clearIndicators(): Promise<void>;
}
