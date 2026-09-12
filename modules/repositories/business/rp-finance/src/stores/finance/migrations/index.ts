import { AccessTagsMigration } from "back-core";
import CreateTransactions from "./createTransactions";

// One tag relation for the store, added last so `transactions` already exists.
export default [CreateTransactions, AccessTagsMigration];
