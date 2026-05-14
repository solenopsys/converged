import { BaseRepositorySQL, type KeySQL } from "back-core";

export interface TransactionKey extends KeySQL {
  id: string;
}

export interface TransactionEntity {
  id: string;
  type: string;
  category: string;
  amount: number;
  currency: string;
  description?: string | null;
  orderId?: string | null;
  counterparty?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  isPaid: number; // SQLite boolean: 0/1
  createdAt: string;
  updatedAt: string;
}

export class TransactionRepository extends BaseRepositorySQL<TransactionKey, TransactionEntity> {}
