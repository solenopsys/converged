import { BaseRepositorySQL, type KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface OrderKey extends KeySQL {
	id: string;
}

export interface OrderEntity {
	id: string;
	requestId?: string | null;
	modelName: string;
	productionMethod: string;
	status: string;
	quantity: number;
	weightGrams?: number | null;
	material?: string | null;
	equipmentId?: string | null;
	dueAt?: ISODateString | null;
	notes?: string | null;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export class OrderRepository extends BaseRepositorySQL<OrderKey, OrderEntity> {}
