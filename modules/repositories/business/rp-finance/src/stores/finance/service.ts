import {
  AccessTags,
  generateULID,
  type SqlStore,
  visibleFrom,
} from "back-core";
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
  /**
   * Who may see which transaction.
   *
   * The ledger is the company's, not one bookkeeper's, so a transaction is
   * created `authenticated` — the same reach the finance screens had before
   * the tags — and additionally carries the tag of whoever recorded it. Two
   * things change even so: a caller without a token now sees an empty ledger
   * rather than all of it, and a correction is limited to the person or team
   * the entry belongs to. Narrowing the whole ledger to `team-finance` is then
   * a matter of dropping the open tag, with no query to rewrite.
   */
  readonly access: AccessTags;

  constructor(private store: SqlStore) {
    this.access = new AccessTags(store);
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
    await this.access.tagNew(id, { visibility: "authenticated" });
    return id;
  }

  /** A transaction the caller holds no tag for reads as absent. */
  async getTransaction(id: TransactionId): Promise<Transaction | undefined> {
    if (!(await this.access.canRead(id))) return undefined;
    const entity = await this.repo.findById({ id });
    return entity ? this.toTransaction(entity) : undefined;
  }

  async patchTransaction(id: TransactionId, patch: TransactionPatch): Promise<void> {
    // Correcting an entry is not reading it: the open tag does not carry here.
    await this.access.requireWrite(id);
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
    await this.access.requireWrite(id);
    const existing = await this.repo.findById({ id });
    if (!existing) return false;
    await this.repo.delete({ id });
    // The tags go with the row: a leftover link would later match a reused id.
    await this.access.dropObject(id);
    return true;
  }

  async listTransactions(params: TransactionListParams): Promise<PaginatedResult<Transaction>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.applyFilters(this.visible(), params)
      .selectAll("obj")
      .orderBy("obj.createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // The total is taken with the page's own conditions, not just its type:
    // a count over a wider set reports how much the caller is not being shown.
    const countResult = await this.applyFilters(this.visible(), params)
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: (items as TransactionEntity[]).map((e) => this.toTransaction(e)),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  /** Transactions the caller may see, as the base of every list and total. */
  private visible() {
    return visibleFrom(this.store.db, "transactions");
  }

  private applyFilters(query: any, params: TransactionListParams) {
    let next = query;
    if (params.type) next = next.where("obj.type", "=", params.type);
    if (params.category) next = next.where("obj.category", "=", params.category);
    if (params.orderId) next = next.where("obj.orderId", "=", params.orderId);
    if (params.isPaid !== undefined)
      next = next.where("obj.isPaid", "=", params.isPaid ? 1 : 0);
    if (params.from) next = next.where("obj.createdAt", ">=", params.from);
    if (params.to) next = next.where("obj.createdAt", "<=", params.to);
    return next;
  }

  /**
   * Period figures over the transactions the caller may see. Summing the rest
   * would publish the shape of a ledger that is being kept from them.
   */
  async getPeriodSummary(params: PeriodParams): Promise<PeriodSummary> {
    const rows = (await this.visible()
      .selectAll("obj")
      .where("obj.createdAt", ">=", params.from)
      .where("obj.createdAt", "<=", params.to)
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
    const rows = (await this.visible()
      .selectAll("obj")
      .where("obj.createdAt", ">=", params.from)
      .where("obj.createdAt", "<=", params.to)
      .execute()) as TransactionEntity[];

    const byDate = new Map<string, { income: number; expenses: number }>();

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
    const rows = (await this.visible()
      .selectAll("obj")
      .where("obj.type", "=", type)
      .where("obj.isPaid", "=", 0)
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
