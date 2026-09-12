import { AccessTagsMigration } from "back-core";
import CreateDashboardPins from "./createDashboardPins";
import PerUserWidgetIds from "./perUserWidgetIds";

// One tag relation for the store, added last so `dashboard_indicator_pins`
// already exists. `PerUserWidgetIds` comes before it: while `widgetId` was
// globally unique, a pin could not belong to a person.
export default [CreateDashboardPins, PerUserWidgetIds, AccessTagsMigration];
