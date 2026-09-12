import {
	AccessTags,
	applyKyselyFilter,
	generateULID,
	type KyselyFilterSchema,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	FilterObject,
	Order,
	OrderDailyPoint,
	OrderDashboard,
	OrderId,
	OrderInput,
	OrderListParams,
	OrderPatch,
	OrderProductionMethod,
	OrderStatus,
	OrderStatusCount,
	OrderStatusGroup,
	PaginatedResult,
} from "../../types";
import type { OrderEntity } from "./entities";
import { OrderRepository } from "./entities";

const DEFAULT_STATUS: OrderStatus = "queued";

const STATUS_GROUPS: Record<OrderStatusGroup, OrderStatus[]> = {
	all: [],
	queued: ["draft", "queued"],
	in_progress: ["in_progress"],
	completed: ["completed"],
	blocked: ["paused", "blocked", "cancelled"],
};

const orderFilterSchema: KyselyFilterSchema = {
	requestId: {
		valueType: "string",
		operators: ["eq", "in", "isNull"],
		column: "obj.requestId",
	},
	status: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "obj.status",
	},
	productionMethod: {
		valueType: "string",
		operators: ["eq", "in"],
		column: "obj.productionMethod",
	},
	dueAt: {
		valueType: "date",
		operators: ["isNull", "isNotNull", "gte", "lte", "between"],
		column: "obj.dueAt",
	},
	createdAt: {
		valueType: "date",
		operators: ["gte", "lte", "between"],
		column: "obj.createdAt",
	},
};

export class OrdersStoreService {
	private readonly repo: OrderRepository;
	/**
	 * Who may see which order.
	 *
	 * A production order is shop-wide by meaning — the queue on the floor is the
	 * same queue for everyone working it — so it is created `authenticated` and
	 * additionally carries its author's tag. That keeps the existing screens
	 * showing what they showed, and leaves the narrowing available: drop the
	 * `authenticated` tag and grant `team-*` instead, and the order becomes that
	 * team's alone without any other change.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
		this.repo = new OrderRepository(store, "orders", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	async createOrder(input: OrderInput): Promise<OrderId> {
		const id = generateULID();
		const createdAt = new Date().toISOString();
		const entity: OrderEntity = {
			id,
			requestId: normalizeOptional(input.requestId),
			modelName: input.modelName,
			productionMethod: input.productionMethod,
			status: input.status ?? DEFAULT_STATUS,
			quantity: normalizeQuantity(input.quantity),
			weightGrams: normalizeOptionalNumber(input.weightGrams),
			material: normalizeOptional(input.material),
			equipmentId: normalizeOptional(input.equipmentId),
			dueAt: normalizeOptional(input.dueAt),
			notes: normalizeOptional(input.notes),
			createdAt,
			updatedAt: createdAt,
		};

		await this.repo.create(entity as any);
		await this.access.tagNew(id, { visibility: "authenticated" });
		return id;
	}

	/** An order the caller holds no tag for reads as absent. */
	async getOrder(id: OrderId): Promise<Order | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		const entity = await this.repo.findById({ id });
		return entity ? this.toOrder(entity) : undefined;
	}

	async listOrders(params: OrderListParams): Promise<PaginatedResult<Order>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const statuses = this.resolveStatusFilter(params);

		const items = await this.applyFilters(this.visible(), params, statuses)
			.selectAll("obj")
			.orderBy("obj.updatedAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const countResult = await this.applyFilters(
			this.visible(),
			params,
			statuses,
		)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: (items as OrderEntity[]).map((item) => this.toOrder(item)),
			totalCount: Number(countResult?.count ?? 0),
		};
	}

	async countOrders(filter?: FilterObject): Promise<number> {
		const result = await applyKyselyFilter(
			this.visible(),
			filter,
			orderFilterSchema,
		)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();
		return Number(result?.count ?? 0);
	}

	/** Orders the caller may see, as the base of every listing, count and total. */
	private visible() {
		return visibleFrom(this.store.db, "orders");
	}

	private applyFilters(
		query: any,
		params: OrderListParams,
		statuses: OrderStatus[],
	) {
		let next = query;
		if (params.requestId)
			next = next.where("obj.requestId", "=", params.requestId);
		if (params.productionMethod)
			next = next.where("obj.productionMethod", "=", params.productionMethod);
		if (statuses.length > 0) next = next.where("obj.status", "in", statuses);
		return applyKyselyFilter(next, params.filter, orderFilterSchema);
	}

	async patchOrder(id: OrderId, patch: OrderPatch): Promise<Order> {
		// Editing is not reading: an order open to the floor is still edited by
		// the people it belongs to, so this asks for an identity tag.
		await this.access.requireWrite(id);
		const existing = await this.repo.findById({ id });
		if (!existing) {
			throw new Error(`Order not found: ${id}`);
		}

		const updatedAt = new Date().toISOString();
		const next: Partial<OrderEntity> = {
			updatedAt,
		};

		if (patch.requestId !== undefined)
			next.requestId = normalizeOptional(patch.requestId);
		if (patch.modelName !== undefined) next.modelName = patch.modelName;
		if (patch.productionMethod !== undefined) {
			next.productionMethod = patch.productionMethod;
		}
		if (patch.status !== undefined) next.status = patch.status;
		if (patch.quantity !== undefined)
			next.quantity = normalizeQuantity(patch.quantity);
		if (patch.weightGrams !== undefined) {
			next.weightGrams = normalizeOptionalNumber(patch.weightGrams);
		}
		if (patch.material !== undefined)
			next.material = normalizeOptional(patch.material);
		if (patch.equipmentId !== undefined) {
			next.equipmentId = normalizeOptional(patch.equipmentId);
		}
		if (patch.dueAt !== undefined) next.dueAt = normalizeOptional(patch.dueAt);
		if (patch.notes !== undefined) next.notes = normalizeOptional(patch.notes);

		await this.repo.update({ id }, next as any);
		const updated = await this.repo.findById({ id });
		if (!updated) {
			throw new Error(`Order not found after update: ${id}`);
		}
		return this.toOrder(updated);
	}

	async updateStatus(id: OrderId, status: OrderStatus): Promise<void> {
		await this.patchOrder(id, { status });
	}

	/**
	 * The dashboard totals, over the orders the caller may see. Counting the rest
	 * would report exactly how much work is being kept from them.
	 */
	async getOrderDashboard(): Promise<OrderDashboard> {
		const rows = (await this.visible()
			.selectAll("obj")
			.execute()) as OrderEntity[];
		const orders = rows.map((row) => this.toOrder(row));

		const queuedTotal = orders.filter((o) =>
			STATUS_GROUPS.queued.includes(o.status),
		).length;
		const inProgressTotal = orders.filter((o) =>
			STATUS_GROUPS.in_progress.includes(o.status),
		).length;
		const completedTotal = orders.filter((o) =>
			STATUS_GROUPS.completed.includes(o.status),
		).length;
		const blockedTotal = orders.filter((o) =>
			STATUS_GROUPS.blocked.includes(o.status),
		).length;
		const printingTotal = inProgressTotal;
		const materialWeightGrams = orders.reduce(
			(total, order) => total + (order.weightGrams ?? 0) * order.quantity,
			0,
		);
		const printerCapacity = 8;
		const availablePrinters = printerCapacity;
		const utilizationPercent =
			orders.length > 0
				? Math.round((inProgressTotal / orders.length) * 100)
				: 0;

		return {
			stats: {
				ordersTotal: orders.length,
				queuedTotal,
				inProgressTotal,
				printingTotal,
				completedTotal,
				blockedTotal,
				materialWeightGrams,
				estimatedPrintingHours: 0,
				availablePrinters,
				printerCapacity,
				utilizationPercent,
			},
			daily: this.buildDailyPoints(orders),
			statusCounts: this.buildStatusCounts(orders),
		};
	}

	private resolveStatusFilter(params: OrderListParams): OrderStatus[] {
		if (params.status) return [params.status];
		const group = params.statusGroup ?? "all";
		return STATUS_GROUPS[group] ?? [];
	}

	private buildStatusCounts(orders: Order[]): OrderStatusCount[] {
		return (
			["queued", "in_progress", "completed", "blocked"] as OrderStatusGroup[]
		).map((group) => ({
			group,
			count: orders.filter((order) =>
				STATUS_GROUPS[group].includes(order.status),
			).length,
		}));
	}

	private buildDailyPoints(orders: Order[]): OrderDailyPoint[] {
		const end = new Date();
		const start = new Date(end);
		start.setDate(start.getDate() - 89);

		const byDate = new Map<string, OrderDailyPoint>();
		for (
			const cursor = new Date(start);
			cursor <= end;
			cursor.setDate(cursor.getDate() + 1)
		) {
			const date = cursor.toISOString().slice(0, 10);
			byDate.set(date, {
				date,
				orders: 0,
				inProgress: 0,
				completed: 0,
				materialWeightGrams: 0,
			});
		}

		for (const order of orders) {
			const date = order.createdAt.slice(0, 10);
			const point = byDate.get(date);
			if (!point) continue;
			point.orders += 1;
			if (order.status === "in_progress") point.inProgress += 1;
			if (order.status === "completed") point.completed += 1;
			point.materialWeightGrams += (order.weightGrams ?? 0) * order.quantity;
		}

		return [...byDate.values()];
	}

	private toOrder(entity: OrderEntity): Order {
		return {
			id: entity.id,
			requestId: normalizeUndefined(entity.requestId),
			modelName: entity.modelName,
			productionMethod: (entity.productionMethod ||
				"generic") as OrderProductionMethod,
			status: (entity.status || DEFAULT_STATUS) as OrderStatus,
			quantity: normalizeQuantity(entity.quantity),
			weightGrams: normalizeUndefinedNumber(entity.weightGrams),
			material: normalizeUndefined(entity.material),
			equipmentId: normalizeUndefined(entity.equipmentId),
			dueAt: normalizeUndefined(entity.dueAt),
			notes: normalizeUndefined(entity.notes),
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? entity.createdAt,
		};
	}
}

function normalizeQuantity(value: number | undefined): number {
	if (!Number.isFinite(value)) return 1;
	return Math.max(1, Math.round(Number(value)));
}

function normalizeOptional(value: string | undefined): string | null {
	if (value === undefined) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalNumber(value: number | undefined): number | null {
	if (value === undefined || value === null || !Number.isFinite(value)) {
		return null;
	}
	return Number(value);
}

function normalizeUndefined(
	value: string | null | undefined,
): string | undefined {
	if (!value) return undefined;
	return value;
}

function normalizeUndefinedNumber(
	value: number | string | null | undefined,
): number | undefined {
	if (value === null || value === undefined || value === "") return undefined;
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
}
