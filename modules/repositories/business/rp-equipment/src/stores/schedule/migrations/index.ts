import { AccessTagsMigration } from "back-core";
import CreateScheduleSlots from "./createScheduleSlots";

// Own store, own relation — a slot is written with the tags of the machine it
// occupies, the same way a log is.
export default [CreateScheduleSlots, AccessTagsMigration];
