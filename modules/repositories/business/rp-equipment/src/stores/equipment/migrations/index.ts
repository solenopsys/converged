import { AccessTagsMigration } from "back-core";
import AddEquipmentDetails from "./addEquipmentDetails";
import CreateEquipment from "./createEquipment";

// One tag relation for the store, added last so `equipment` already exists.
export default [CreateEquipment, AddEquipmentDetails, AccessTagsMigration];
