import { DashboardLayout } from "./components/DashboardLayout";
import { CreateWidget, CreateAction } from "front-core";

const SHOW_DASHBOARD = "dashboard.mount";
const REGISTER_DASHBOARD_WIDGET = "dashboard.register_widget";

const createDashboardLayoutWidget: CreateWidget<typeof DashboardLayout> = () => ({
  view: DashboardLayout,
  placement: () => "center",

  commands: {},
});

const dashboardWidgetActions: string[] = [];

const createDashboardMountAction: CreateAction<any> = (bus) => ({
  id: SHOW_DASHBOARD,
  llm: {
    microfrontend: "dasboards-mf",
    brief: "llm.actions.dashboard_mount.brief",
    description: "llm.actions.dashboard_mount.description",
  },
  exposure: "llm",
  priority: "normal",
  invoke: (params: {}) => {
    const widget = createDashboardLayoutWidget(bus);
    bus.present({ widget });

    for (const actionId of dashboardWidgetActions) {
      bus.run(actionId, {});
    }
  }
});

const createRegisterDashboardWidgetAction: CreateAction<any> = () => ({
  id: REGISTER_DASHBOARD_WIDGET,
  llm: {
    microfrontend: "dasboards-mf",
    brief: "llm.actions.dashboard_register_widget.brief",
    description: "llm.actions.dashboard_register_widget.description",
  },
  exposure: "llm",
  priority: "normal",
  invoke: (params: { actionId: string }) => {
    if (!dashboardWidgetActions.includes(params.actionId)) {
      dashboardWidgetActions.push(params.actionId);
    }
  }
});

const ACTIONS = [
  createDashboardMountAction,
  createRegisterDashboardWidgetAction
];

export {
  SHOW_DASHBOARD,
  REGISTER_DASHBOARD_WIDGET,
  createDashboardLayoutWidget,
  createDashboardMountAction
};

export default ACTIONS
