import { generateULID, type SqlStore } from "back-core";
import { TransactionRepository } from "./entities";
import type {
  Transaction,
  TransactionId,
  TransactionInput,
  TransactionPatch,
  TransactionListParams,
  PeriodParams,
  PeriodSummary,
  CashflowDay,
  ReceivableItem,
  PaginatedResult,
} from "../../types";
import type { TransactionEntity } from "./entities";

const DEFAULT_CURRENCY = "RUB";

export class FinanceStoreService {
  private readonly repo: TransactionRepository;

  constructor(private store: SqlStore) {
    this.repo = new TransactionRepository(store, "transactions", {
      primaryKey: "id",
      extractKey: (e) => ({ id: e.id }),
      buildWhereCondition: (k) => ({ id: k.id }),
    });
  }

  async addTransaction(input: TransactionInput): Promise<TransactionId> {
    const id = generateULID();
    const now = new Date().toISOString();
    const entity: TransactionEntity = {
      id,
      type: input.type,
      category: input.category,
      amount: input.amount,
      currency: input.currency ?? DEFAULT_CURRENCY,
      description: input.description ?? null,
      orderId: input.orderId ?? null,
      counterparty: input.counterparty ?? null,
      dueAt: input.dueAt ?? null,
      paidAt: input.paidAt ?? null,
      isPaid: input.isPaid ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(entity as any);
    return id;
  }

  async getTransaction(id: TransactionId): Promise<Transaction | undefined> {
    const entity = await this.repo.findById({ id });
    return entity ? this.toTransaction(entity) : undefined;
  }

  async patchTransaction(id: TransactionId, patch: TransactionPatch): Promise<void> {
    const existing = await this.repo.findById({ id });
    if (!existing) throw new Error(`Transaction not found: ${id}`);

    const next: Partial<TransactionEntity> = { updatedAt: new Date().toISOString() };
    if (patch.category !== undefined) next.category = patch.category;
    if (patch.amount !== undefined) next.amount = patch.amount;
    if (patch.description !== undefined) next.description = patch.description ?? null;
    if (patch.orderId !== undefined) next.orderId = patch.orderId ?? null;
    if (patch.counterparty !== undefined) next.counterparty = patch.counterparty ?? null;
    if (patch.dueAt !== undefined) next.dueAt = patch.dueAt ?? null;
    if (patch.paidAt !== undefined) next.paidAt = patch.paidAt ?? null;
    if (patch.isPaid !== undefined) next.isPaid = patch.isPaid ? 1 : 0;

    await this.repo.update({ id }, next as any);
  }

  async deleteTransaction(id: TransactionId): Promise<boolean> {
    const existing = await this.repo.findById({ id });
    if (!existing) return false;
    await this.repo.delete({ id });
    return true;
  }

  async listTransactions(params: TransactionListParams): Promise<PaginatedResult<Transaction>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("transactions").selectAll();
    if (params.type) query = query.where("type", "=", params.type);
    if (params.category) query = query.where("category", "=", params.category);
    if (params.orderId) query = query.where("orderId", "=", params.orderId);
    if (params.isPaid !== undefined) query = query.where("isPaid", "=", params.isPaid ? 1 : 0);
    if (params.from) query = query.where("createdAt", ">=", params.from);
    if (params.to) query = query.where("createdAt", "<=", params.to);

    const items = await query.orderBy("createdAt", "desc").limit(limit).offset(offset).execute();

    let countQuery = this.store.db
      .selectFrom("transactions")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.type) countQuery = countQuery.where("type", "=", params.type);
    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (items as TransactionEntity[]).map((e) => this.toTransaction(e)),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  async getPeriodSummary(params: PeriodParams): Promise<PeriodSummary> {
    const rows = (await this.store.db
      .selectFrom("transactions")
      .selectAll()
      .where("createdAt", ">=", params.from)
      .where("createdAt", "<=", params.to)
      .execute()) as TransactionEntity[];

    const currency = params.currency ?? DEFAULT_CURRENCY;
    const filtered = rows.filter((r) => r.currency === currency);

    const revenue = filtered
      .filter((r) => r.type === "income")
      .reduce((s, r) => s + r.amount, 0);
    const expenses = filtered
      .filter((r) => r.type === "expense")
      .reduce((s, r) => s + r.amount, 0);
    const profit = revenue - expenses;
    const marginPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return { revenue, expenses, profit, marginPercent, currency };
  }

  async getCashflowCalendar(params: PeriodParams): Promise<CashflowDay[]> {
    const rows = (await this.store.db
      .selectFrom("transactions")
      .selectAll()
      .where("createdAt", ">=", params.from)
      .where("createdAt", "<=", params.to)
      .execute()) as TransactionEntity[];

    const byDate = new Map<string, { income: number; expenses: number }>();

    // Заполняем каждый день диапазона
    const start = new Date(params.from.slice(0, 10));
    const end = new Date(params.to.slice(0, 10));
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      byDate.set(d.toISOString().slice(0, 10), { income: 0, expenses: 0 });
    }

    for (const row of rows) {
      const date = row.createdAt.slice(0, 10);
      const day = byDate.get(date);
      if (!day) continue;
      if (row.type === "income") day.income += row.amount;
      if (row.type === "expense") day.expenses += row.amount;
    }

    let runningBalance = 0;
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { income, expenses }]) => {
        runningBalance += income - expenses;
        return { date, income, expenses, balance: runningBalance };
      });
  }

  async getReceivables(): Promise<ReceivableItem[]> {
    return this.getOpenItems("income");
  }

  async getPayables(): Promise<ReceivableItem[]> {
    return this.getOpenItems("expense");
  }

  private async getOpenItems(type: string): Promise<ReceivableItem[]> {
    const rows = (await this.store.db
      .selectFrom("transactions")
      .selectAll()
      .where("type", "=", type)
      .where("isPaid", "=", 0)
      .execute()) as TransactionEntity[];

    const now = Date.now();
    return rows.map((r) => {
      const dueMs = r.dueAt ? new Date(r.dueAt).getTime() : null;
      const daysPastDue = dueMs ? Math.floor((now - dueMs) / 86400000) : 0;
      return {
        transactionId: r.id,
        counterparty: r.counterparty ?? undefined,
        amount: r.amount,
        currency: r.currency,
        dueAt: r.dueAt ?? undefined,
        daysPastDue,
      };
    });
  }

  private toTransaction(entity: TransactionEntity): Transaction {
    return {
      id: entity.id,
      type: entity.type as any,
      category: entity.category,
      amount: entity.amount,
      currency: entity.currency,
      description: entity.description ?? undefined,
      orderId: entity.orderId ?? undefined,
      counterparty: entity.counterparty ?? undefined,
      dueAt: entity.dueAt ?? undefined,
      paidAt: entity.paidAt ?? undefined,
      isPaid: entity.isPaid === 1,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
