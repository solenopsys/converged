import { SimpleLayout } from "./components/SimpleLayout";
import { SidebarLayout } from "./components/SidebarLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { MenuView } from "converged-core";
import { Widget, Action, present } from "converged-core";

export const SimpleLayoutWidget: Widget<typeof SimpleLayout> = {
  view: SimpleLayout,
  placement: (ctx) => "full",
  config: {},
  mount: () => { },
  bindings: {},
};

export const LeftMenuWidget: Widget<typeof MenuView> = {
  view: MenuView,
  placement: (ctx) => "left",
  config: {},
  mount: () => { },
  bindings: {},
};

export const SidebarLayoutWidget: Widget<typeof SidebarLayout> = {
  view: SidebarLayout,
  placement: (ctx) => "full",
  config: {},
  mount: () => { },
  bindings: {},
};

export const DashboardLayoutWidget: Widget<typeof DashboardLayout> = {
  view: DashboardLayout,
  placement: (ctx) => "center",
  config: {},
  mount: () => { },
  bindings: {},
};

const LAYOUTS = {simple:SimpleLayoutWidget, sidebar:SidebarLayoutWidget, dashboard:DashboardLayoutWidget};

export const LayoutMountAction: Action = {
  id: "layout.mount",
  description: "Монтирование layout",
  invoke: (params:{widget: Widget, context: any}) => {
    console.log("Layout mount", params);
    const slot = params.widget.placement(params.context)
    console.log("Slot", slot);
    present(params.widget,slot);
  }
}

export const LeftMenuMountAction: Action = {
  id: "left.menu.mount",
  description: "Монтирование left menu",
  invoke: (params:{widget: Widget, context: any}) => {
    const widget=LeftMenuWidget;
    const slot = widget.placement(params.context)
    console.log("Slot", slot);
    present(widget,slot);
  }
}

export const MenuAdd: Action = {
  id: "menu.add",
  description: "Добавление пунктов меню",
  invoke: (menu: any, context: any) => {
  }
}

export const LayoutListAction: Action = {
  id: "layout.mapping",
  description: "Список layout",
  invoke: () => {
    return LAYOUTS
  }
}

 

export const ACTIONS= [
  LayoutMountAction,
  LeftMenuMountAction,
  LayoutListAction,
  MenuAdd
]


