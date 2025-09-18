import { SimpleLayout } from "./components/SimpleLayout";
import { SidebarLayout } from "./components/SidebarLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { MenuView } from "converged-core";
import { CreateWidget, CreateAction, present } from "converged-core";
import { sample } from "effector";
import domain from "./domain";

const LAYOUT_MOUNT = "layout.mount";
const LEFT_MENU_MOUNT = "left.menu.mount";
const MENU_ADD = "menu.add";
const LAYOUT_LIST = "layout.mapping";

// Events and Effects
const layoutMountFx = domain.createEffect<any, any>();
const menuMountFx = domain.createEffect<any, any>();
const layoutMountEvent = domain.createEvent<{ widget: any, context: any }>();
const menuMountEvent = domain.createEvent<{ widget: any, context: any }>();
const menuAddEvent = domain.createEvent<{ menu: any, context: any }>();

sample({ clock: layoutMountEvent, target: layoutMountFx });
sample({ clock: menuMountEvent, target: menuMountFx });

const createSimpleLayoutWidget: CreateWidget<typeof SimpleLayout> = () => ({
  view: SimpleLayout,
  placement: () => "full",
  commands: {},
});

const createLeftMenuWidget: CreateWidget<typeof MenuView> = (bus) => ({
  view: MenuView,
  placement: () => "left",
 
  commands: {
    onClick: (actionId: string) => {
      bus.run(actionId, {});
    }
  },
});

const createSidebarLayoutWidget: CreateWidget<typeof SidebarLayout> = () => ({
  view: SidebarLayout,
  placement: () => "full",
 
  commands: {},
});

const createDashboardLayoutWidget: CreateWidget<typeof DashboardLayout> = () => ({
  view: DashboardLayout,
  placement: () => "center",
 
  commands: {},
});

const LAYOUTS = {
  simple: createSimpleLayoutWidget,
  sidebar: createSidebarLayoutWidget,
  dashboard: createDashboardLayoutWidget
};

const createLayoutMountAction: CreateAction<any> = (bus) => ({
  id: LAYOUT_MOUNT,
  description: "Mount layout",
  invoke: (params: { widget: any, context: any }) => {
    console.log("Layout mount", params);
    const widgetFactory = params.widget;
    const widget = widgetFactory(bus);
    const slot = widget.placement();
    console.log("Slot", slot);
    bus.present(widget, slot);
  }
});

const createLeftMenuMountAction: CreateAction<any> = (bus) => ({
  id: LEFT_MENU_MOUNT,
  description: "Mount left menu",
  invoke: (params: { widget: any, context: any }) => {
    const widget = createLeftMenuWidget(bus);
    const slot = widget.placement();
    console.log("Slot", slot);
    bus.present(widget, slot);
  }
});

const createMenuAddAction: CreateAction<any> = () => ({
  id: MENU_ADD,
  description: "Add menu items",
  invoke: (menu: any, context: any) => {
    menuAddEvent({ menu, context });
  }
});

const createLayoutListAction: CreateAction<any> = () => ({
  id: LAYOUT_LIST,
  description: "Get layouts list",
  invoke: () => {
    return LAYOUTS;
  }
});

const ACTIONS = [
  createLayoutMountAction,
  createLeftMenuMountAction,
  createLayoutListAction,
  createMenuAddAction
];

export {
  LAYOUT_MOUNT,
  LEFT_MENU_MOUNT,
  MENU_ADD,
  LAYOUT_LIST,
  createSimpleLayoutWidget,
  createLeftMenuWidget,
  createSidebarLayoutWidget,
  createDashboardLayoutWidget,
  createLayoutMountAction,
  createLeftMenuMountAction,
  createMenuAddAction,
  createLayoutListAction,
  LAYOUTS
};

export  default ACTIONS 