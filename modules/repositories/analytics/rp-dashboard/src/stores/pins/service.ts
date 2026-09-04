import { generateULID, type SqlStore } from "back-core";
import type {
	DashboardIndicatorPin,
	DashboardIndicatorPinInput,
} from "../../types";

type DashboardPinEntity = {
	id: string;
	widgetId: string;
	title: string | null;
	source: string | null;
	componentKey: string | null;
	position: number;
	createdAt: string;
	updatedAt: string;
};

type DashboardPinsDatabase = {
	dashboard_indicator_pins: DashboardPinEntity;
};

const TABLE_NAME = "dashboard_indicator_pins";

export class DashboardPinsStoreService {
	constructor(private store: SqlStore<DashboardPinsDatabase>) {}

	async pin(input: DashboardIndicatorPinInput): Promise<DashboardIndicatorPin> {
		this.validateInput(input);

		const widgetId = input.widgetId.trim();
		const now = new Date().toISOString();
		const existing = await this.store.db
			.selectFrom(TABLE_NAME)
			.selectAll()
			.where("widgetId", "=", widgetId)
			.executeTakeFirst();

		if (existing) {
			await this.store.db
				.updateTable(TABLE_NAME)
				.set({
					title: this.nullable(input.title),
					source: this.nullable(input.source),
					componentKey: this.nullable(input.componentKey),
					position: input.position ?? existing.position,
					updatedAt: now,
				})
				.where("widgetId", "=", widgetId)
				.execute();

			return this.getByWidgetId(widgetId);
		}

		const entity: DashboardPinEntity = {
			id: generateULID(),
			widgetId,
			title: this.nullable(input.title),
			source: this.nullable(input.source),
			componentKey: this.nullable(input.componentKey),
			position: input.position ?? 0,
			createdAt: now,
			updatedAt: now,
		};

		await this.store.db.insertInto(TABLE_NAME).values(entity).execute();

		return this.toPin(entity);
	}

	async unpin(widgetId: string): Promise<void> {
		const normalized = widgetId.trim();
		if (!normalized) return;

		await this.store.db
			.deleteFrom(TABLE_NAME)
			.where("widgetId", "=", normalized)
			.execute();
	}

	async list(): Promise<DashboardIndicatorPin[]> {
		const rows = await this.store.db
			.selectFrom(TABLE_NAME)
			.selectAll()
			.orderBy("position", "asc")
			.orderBy("updatedAt", "desc")
			.orderBy("id", "asc")
			.execute();

		return rows.map((row) => this.toPin(row));
	}

	async clear(): Promise<void> {
		await this.store.db.deleteFrom(TABLE_NAME).execute();
	}

	private async getByWidgetId(
		widgetId: string,
	): Promise<DashboardIndicatorPin> {
		const row = await this.store.db
			.selectFrom(TABLE_NAME)
			.selectAll()
			.where("widgetId", "=", widgetId)
			.executeTakeFirst();

		if (!row) {
			throw new Error(`Dashboard pin not found: ${widgetId}`);
		}

		return this.toPin(row);
	}

	private validateInput(input: DashboardIndicatorPinInput): void {
		if (!input.widgetId?.trim()) {
			const error = new Error("widgetId is required") as Error & {
				statusCode?: number;
			};
			error.statusCode = 400;
			throw error;
		}
	}

	private nullable(value: string | undefined): string | null {
		const normalized = value?.trim();
		return normalized ? normalized : null;
	}

	private toPin(row: DashboardPinEntity): DashboardIndicatorPin {
		return {
			id: row.id,
			widgetId: row.widgetId,
			title: row.title ?? undefined,
			source: row.source ?? undefined,
			componentKey: row.componentKey ?? undefined,
			position: row.position,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}
}
