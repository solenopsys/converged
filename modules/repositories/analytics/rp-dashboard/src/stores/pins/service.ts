import {
	AccessTags,
	generateULID,
	identityTags,
	type SqlStore,
	visibleFrom,
} from "back-core";
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
	/**
	 * Whose dashboard a pin is on.
	 *
	 * A pin is one person's arrangement of their own screen, so it is `private`
	 * and carries only their tag. Before that, `widgetId` was the whole of the
	 * identity of a pin: two people pinning the same indicator shared one row,
	 * and either of them unpinning took it off both dashboards. Now the widget
	 * id is only unique within what the caller holds — a shared dashboard is a
	 * pin with a `team-*` tag on it, which is a grant and not a collision.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore<DashboardPinsDatabase>) {
		this.access = new AccessTags(store as any);
	}

	async pin(input: DashboardIndicatorPinInput): Promise<DashboardIndicatorPin> {
		this.validateInput(input);

		const widgetId = input.widgetId.trim();
		const now = new Date().toISOString();
		const existing = await this.ownPin(widgetId);

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
				.where("id", "=", existing.id)
				.execute();

			return this.getById(existing.id);
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
		await this.access.tagNew(entity.id, { visibility: "private" });

		return this.toPin(entity);
	}

	/** Takes the pin off the caller's own dashboard, and nobody else's. */
	async unpin(widgetId: string): Promise<void> {
		const normalized = widgetId.trim();
		if (!normalized) return;

		const own = await this.ownPin(normalized);
		if (!own) return;

		await this.store.db
			.deleteFrom(TABLE_NAME)
			.where("id", "=", own.id)
			.execute();
		// The tags go with the row: a leftover link would later match a reused id.
		await this.access.dropObject(own.id);
	}

	/** The caller's dashboard: their own pins, plus any shared with them. */
	async list(): Promise<DashboardIndicatorPin[]> {
		const rows = await visibleFrom(this.store.db as any, TABLE_NAME)
			.selectAll("obj")
			.orderBy("obj.position", "asc")
			.orderBy("obj.updatedAt", "desc")
			.orderBy("obj.id", "asc")
			.execute();

		return (rows as DashboardPinEntity[]).map((row) => this.toPin(row));
	}

	/** Clears the caller's dashboard. It used to clear everybody's. */
	async clear(): Promise<void> {
		const own = (await this.ownPins().select("obj.id").execute()) as {
			id: string;
		}[];
		if (own.length === 0) return;

		const ids = own.map((row) => row.id);
		await this.store.db.deleteFrom(TABLE_NAME).where("id", "in", ids).execute();
		for (const id of ids) await this.access.dropObject(id);
	}

	/**
	 * The pins that are the caller's to change — their own and their groups',
	 * with `public` and `authenticated` left out. A pin somebody shared onto a
	 * screen the caller merely reads is not theirs to unpin.
	 */
	private ownPins() {
		return visibleFrom(this.store.db as any, TABLE_NAME, {
			tags: identityTags(),
		});
	}

	private async ownPin(
		widgetId: string,
	): Promise<DashboardPinEntity | undefined> {
		const row = await this.ownPins()
			.selectAll("obj")
			.where("obj.widgetId", "=", widgetId)
			.executeTakeFirst();
		return row as DashboardPinEntity | undefined;
	}

	private async getById(id: string): Promise<DashboardIndicatorPin> {
		const row = await this.store.db
			.selectFrom(TABLE_NAME)
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!row) {
			throw new Error(`Dashboard pin not found: ${id}`);
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
