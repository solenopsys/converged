export type TransactionId = string;
export type ISODateString = string;

export type TransactionType = "income" | "expense" | "transfer";

export type Transaction = {
  id: TransactionId;
  type: TransactionType;
  category: string;
  amount: number;
  currency: string;
  description?: string;
  orderId?: string;
  counterparty?: string;
  dueAt?: ISODateString;
  paidAt?: ISODateString;
  isPaid: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type TransactionInput = {
  type: TransactionType;
  category: string;
  amount: number;
  currency?: string;
  description?: string;
  orderId?: string;
  counterparty?: string;
  dueAt?: ISODateString;
  paidAt?: ISODateString;
  isPaid?: boolean;
};

export type TransactionPatch = {
  category?: string;
  amount?: number;
  description?: string;
  orderId?: string;
  counterparty?: string;
  dueAt?: ISODateString;
  paidAt?: ISODateString;
  isPaid?: boolean;
};

export type TransactionListParams = {
  offset: number;
  limit: number;
  type?: TransactionType;
  category?: string;
  orderId?: string;
  isPaid?: boolean;
  from?: ISODateString;
  to?: ISODateString;
};

export type PeriodParams = {
  from: ISODateString;
  to: ISODateString;
  currency?: string;
};

export type PeriodSummary = {
  revenue: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  currency: string;
};

export type CashflowDay = {
  date: string;
  income: number;
  expenses: number;
  balance: number;
};

export type ReceivableItem = {
  transactionId: TransactionId;
  counterparty?: string;
  amount: number;
  currency: string;
  dueAt?: ISODateString;
  daysPastDue: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export interface FinanceService {
  addTransaction(input: TransactionInput): Promise<TransactionId>;
  getTransaction(id: TransactionId): Promise<Transaction | undefined>;
  patchTransaction(id: TransactionId, patch: TransactionPatch): Promise<void>;
  deleteTransaction(id: TransactionId): Promise<boolean>;
  listTransactions(params: TransactionListParams): Promise<PaginatedResult<Transaction>>;

  getPeriodSummary(params: PeriodParams): Promise<PeriodSummary>;
  getCashflowCalendar(params: PeriodParams): Promise<CashflowDay[]>;
  getReceivables(): Promise<ReceivableItem[]>;
  getPayables(): Promise<ReceivableItem[]>;
}
