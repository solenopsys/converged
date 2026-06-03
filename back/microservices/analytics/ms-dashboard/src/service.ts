import { StoresController } from "./stores";
import type {
	DashboardIndicatorPin,
	DashboardIndicatorPinInput,
	DashboardService,
} from "./types";

const MS_ID = "dashboard-ms";

export class DashboardServiceImpl implements DashboardService {
	private stores!: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	async init(): Promise<void> {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	async pinIndicator(
		input: DashboardIndicatorPinInput,
	): Promise<DashboardIndicatorPin> {
		await this.init();
		return this.stores.pins.pin(input);
	}

	async unpinIndicator(widgetId: string): Promise<void> {
		await this.init();
		await this.stores.pins.unpin(widgetId);
	}

	async listIndicators(): Promise<DashboardIndicatorPin[]> {
		await this.init();
		return this.stores.pins.list();
	}

	async clearIndicators(): Promise<void> {
		await this.init();
		await this.stores.pins.clear();
	}

	async destroy(): Promise<void> {
		await this.stores?.destroy();
	}
}
