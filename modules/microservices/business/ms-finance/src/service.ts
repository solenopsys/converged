import { StoresController } from "./stores";
import type {
  Transaction,
  TransactionId,
  TransactionInput,
  TransactionPatch,
  TransactionListParams,
  FinanceService,
  PeriodParams,
  PeriodSummary,
  CashflowDay,
  ReceivableItem,
  PaginatedResult,
} from "./types";

const MS_ID = "finance-ms";

export class FinanceServiceImpl implements FinanceService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();
    return this.initPromise;
  }

  addTransaction(input: TransactionInput): Promise<TransactionId> {
    return this.stores.finance.addTransaction(input);
  }

  getTransaction(id: TransactionId): Promise<Transaction | undefined> {
    return this.stores.finance.getTransaction(id);
  }

  patchTransaction(id: TransactionId, patch: TransactionPatch): Promise<void> {
    return this.stores.finance.patchTransaction(id, patch);
  }

  deleteTransaction(id: TransactionId): Promise<boolean> {
    return this.stores.finance.deleteTransaction(id);
  }

  listTransactions(params: TransactionListParams): Promise<PaginatedResult<Transaction>> {
    return this.stores.finance.listTransactions(params);
  }

  getPeriodSummary(params: PeriodParams): Promise<PeriodSummary> {
    return this.stores.finance.getPeriodSummary(params);
  }

  getCashflowCalendar(params: PeriodParams): Promise<CashflowDay[]> {
    return this.stores.finance.getCashflowCalendar(params);
  }

  getReceivables(): Promise<ReceivableItem[]> {
    return this.stores.finance.getReceivables();
  }

  getPayables(): Promise<ReceivableItem[]> {
    return this.stores.finance.getPayables();
  }
}
