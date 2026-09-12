import { AccessTagsMigration } from "back-core";
import CreateOrders from "./createOrders";

// One tag relation for the store, added last so `orders` already exists.
export default [CreateOrders, AccessTagsMigration];
