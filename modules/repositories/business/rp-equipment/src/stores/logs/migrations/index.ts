import { AccessTagsMigration } from "back-core";
import CreateEquipmentLogs from "./createEquipmentLogs";

// Logs live in their own store, so they get their own relation: a tag table
// belongs to a store, and this one cannot join against the equipment's. What
// keeps the two in step is that a log is written with the tags its machine
// carried at the time (see `service.ts`).
export default [CreateEquipmentLogs, AccessTagsMigration];
