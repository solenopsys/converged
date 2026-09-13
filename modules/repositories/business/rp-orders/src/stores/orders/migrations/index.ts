import { AccessTagsMigration } from "back-core";
import AddOrderCustomer from "./addOrderCustomer";
import CreateOrders from "./createOrders";

// One tag relation for the store, added last so `orders` already exists.
export default [CreateOrders, AddOrderCustomer, AccessTagsMigration];
