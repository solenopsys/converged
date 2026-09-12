import { AccessTagsMigration } from "back-core";
import CreateStaffAbsences from "./createStaffAbsences";
import CreateStaffMembers from "./createStaffMembers";
import CreateStaffShifts from "./createStaffShifts";

// One tag relation serves all three tables: ids are ULIDs, unique across the
// store, so the `JOIN` back to the owning table is what tells a shift from an
// absence. Listed last, after the tables it is joined against exist.
export default [
  CreateStaffMembers,
  CreateStaffShifts,
  CreateStaffAbsences,
  AccessTagsMigration,
];
