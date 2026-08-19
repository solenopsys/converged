import { generateULID, type SqlStore } from "back-core";
import type {
	Order,
	OrderDailyPoint,
	OrderDashboard,
	OrderId,
	OrderInput,
	OrderListParams,
	OrderPatch,
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

export class OrdersStoreService {
	private readonly repo: OrderRepository;

	constructor(private store: SqlStore) {
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
		return id;
	}

	async getOrder(id: OrderId): Promise<Order | undefined> {
		const entity = await this.repo.findById({ id });
		return entity ? this.toOrder(entity) : undefined;
	}

	async listOrders(params: OrderListParams): Promise<PaginatedResult<Order>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const statuses = this.resolveStatusFilter(params);

		let query = this.store.db.selectFrom("orders").selectAll();
		if (params.requestId) {
			query = query.where("requestId", "=", params.requestId);
		}
		if (params.productionMethod) {
			query = query.where("productionMethod", "=", params.productionMethod);
		}
		if (statuses.length > 0) {
			query = query.where("status", "in", statuses);
		}

		const items = await query
			.orderBy("updatedAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		let countQuery = this.store.db
			.selectFrom("orders")
			.select(({ fn }) => fn.countAll().as("count"));
		if (params.requestId) {
			countQuery = countQuery.where("requestId", "=", params.requestId);
		}
		if (params.productionMethod) {
			countQuery = countQuery.where("productionMethod", "=", params.productionMethod);
		}
		if (statuses.length > 0) {
			countQuery = countQuery.where("status", "in", statuses);
		}
		const countResult = await countQuery.executeTakeFirst();

		return {
			items: (items as OrderEntity[]).map((item) => this.toOrder(item)),
			totalCount: Number(countResult?.count ?? 0),
		};
	}

	async patchOrder(id: OrderId, patch: OrderPatch): Promise<Order> {
		const existing = await this.repo.findById({ id });
		if (!existing) {
			throw new Error(`Order not found: ${id}`);
		}

		const updatedAt = new Date().toISOString();
		const next: Partial<OrderEntity> = {
			updatedAt,
		};

		if (patch.requestId !== undefined) next.requestId = normalizeOptional(patch.requestId);
		if (patch.modelName !== undefined) next.modelName = patch.modelName;
		if (patch.productionMethod !== undefined) {
			next.productionMethod = patch.productionMethod;
		}
		if (patch.status !== undefined) next.status = patch.status;
		if (patch.quantity !== undefined) next.quantity = normalizeQuantity(patch.quantity);
		if (patch.weightGrams !== undefined) {
			next.weightGrams = normalizeOptionalNumber(patch.weightGrams);
		}
		if (patch.material !== undefined) next.material = normalizeOptional(patch.material);
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

	async getOrderDashboard(): Promise<OrderDashboard> {
		const rows = (await this.store.db
			.selectFrom("orders")
			.selectAll()
			.execute()) as OrderEntity[];
		const orders = rows.map((row) => this.toOrder(row));

		const queuedTotal = orders.filter((o) => STATUS_GROUPS.queued.includes(o.status)).length;
		const inProgressTotal = orders.filter((o) => STATUS_GROUPS.in_progress.includes(o.status)).length;
		const completedTotal = orders.filter((o) => STATUS_GROUPS.completed.includes(o.status)).length;
		const blockedTotal = orders.filter((o) => STATUS_GROUPS.blocked.includes(o.status)).length;
		const utilizationPercent = orders.length > 0
			? Math.round((inProgressTotal / orders.length) * 100)
			: 0;

		return {
			stats: {
				ordersTotal: orders.length,
				queuedTotal,
				inProgressTotal,
				completedTotal,
				blockedTotal,
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
		return (["queued", "in_progress", "completed", "blocked"] as OrderStatusGroup[]).map(
			(group) => ({
				group,
				count: orders.filter((order) => STATUS_GROUPS[group].includes(order.status)).length,
			}),
		);
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
			productionMethod: (entity.productionMethod || "generic") as OrderProductionMethod,
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

function normalizeUndefined(value: string | null | undefined): string | undefined {
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

